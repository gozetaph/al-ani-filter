import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const ipRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (ipRequests.get(ip) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequests.set(ip, recent);
    return true;
  }

  recent.push(now);
  ipRequests.set(ip, recent);

  if (ipRequests.size > 1000) {
    ipRequests.forEach((timestamps, key) => {
      if (timestamps.every((ts) => ts <= windowStart)) {
        ipRequests.delete(key);
      }
    });
  }

  return false;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function normalizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

interface IncomingOrderItem {
  product_id: string;
  quantity: number;
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const customerName = normalizeString(body.customer_name, 120);
    const phone = normalizeString(body.phone, 24);
    const governorate = normalizeString(body.governorate, 80);
    const detailedAddress = normalizeString(body.detailed_address, 300);
    const notes = normalizeString(body.notes, 500);

    if (!customerName || customerName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid customer_name is required" },
        { status: 400 }
      );
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return NextResponse.json(
        { success: false, error: "Valid phone number is required" },
        { status: 400 }
      );
    }

    if (!governorate || !detailedAddress || detailedAddress.length < 4) {
      return NextResponse.json(
        { success: false, error: "Governorate and detailed_address are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json(
        { success: false, error: "At least one order item is required" },
        { status: 400 }
      );
    }

    const parsedItems: IncomingOrderItem[] = [];
    for (const rawItem of body.items) {
      if (!rawItem || typeof rawItem !== "object") {
        return NextResponse.json(
          { success: false, error: "Invalid order item format" },
          { status: 400 }
        );
      }
      const itemObj = rawItem as Record<string, unknown>;
      const productId = normalizeString(itemObj.product_id, 64);
      const quantity = Number(itemObj.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return NextResponse.json(
          { success: false, error: "Each item must have a valid product_id and quantity (1-100)" },
          { status: 400 }
        );
      }
      parsedItems.push({ product_id: productId, quantity });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Order service is temporarily unavailable" },
        { status: 503 }
      );
    }

    // 1. Authoritative shipping fee lookup from DB
    const { data: zone, error: zoneError } = await supabase
      .from("shipping_zones")
      .select("governorate, governorate_ar, delivery_fee")
      .or(`governorate.eq.${governorate},governorate_ar.eq.${governorate}`)
      .maybeSingle();

    if (zoneError || !zone) {
      return NextResponse.json(
        { success: false, error: "Invalid shipping governorate" },
        { status: 400 }
      );
    }

    // 2. Authoritative product price lookup from DB
    const productIds = Array.from(new Set(parsedItems.map((i) => i.product_id)));
    const { data: dbProducts, error: productsError } = await supabase
      .from("products")
      .select("id, title, price, is_active")
      .in("id", productIds)
      .eq("is_active", true);

    if (productsError || !dbProducts || dbProducts.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more selected products are unavailable" },
        { status: 400 }
      );
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    let subtotal = 0;
    const summaryLines: string[] = [];
    const orderItemsRows: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const item of parsedItems) {
      const product = productMap.get(item.product_id);
      if (!product || typeof product.price !== "number" || product.price < 0) {
        return NextResponse.json(
          { success: false, error: "Invalid product pricing configuration" },
          { status: 400 }
        );
      }
      subtotal += product.price * item.quantity;
      summaryLines.push(`• ${product.title} × ${item.quantity}`);
      orderItemsRows.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
      });
    }

    const shippingFee = zone.delivery_fee;
    const totalAmount = subtotal + shippingFee;
    const orderId = `AF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const itemsSummary = summaryLines.join("\n");

    // 3. Insert into Supabase Orders table
    const { error: dbError } = await supabase.from("orders").insert([
      {
        id: orderId,
        customer_name: customerName,
        phone,
        governorate: zone.governorate_ar || zone.governorate,
        detailed_address: detailedAddress,
        payment_method: "COD",
        subtotal,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        status: "pending",
        notes: notes ? `${itemsSummary}\nملاحظات: ${notes}` : itemsSummary,
      },
    ]);

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      return NextResponse.json(
        { success: false, error: "Failed to save order" },
        { status: 500 }
      );
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      orderItemsRows.map((row) => ({
        order_id: orderId,
        ...row,
      }))
    );

    if (itemsError) {
      console.error("Supabase order_items insert error:", itemsError);
    }

    // 4. Prepare structured WhatsApp Bot Message
    const formattedMessage =
      `*طلب جديد من الموقع - العاني للفلتر*\n` +
      `───────────────────────\n` +
      `*رقم الطلب:* #${orderId}\n` +
      `*الزبون:* ${customerName}\n` +
      `*رقم الهاتف:* ${phone}\n` +
      `*المحافظة والعنوان:* ${zone.governorate_ar || zone.governorate} - ${detailedAddress}\n` +
      `*المواد المطلوبة:*\n${itemsSummary}\n` +
      `───────────────────────\n` +
      `*المبلغ الإجمالي عند الاستلام (COD):* ${totalAmount.toLocaleString()} د.ع\n` +
      `*(شامل أجور التوصيل: ${shippingFee.toLocaleString()} د.ع)*`;

    // 5. Optional WhatsApp Webhook trigger (only when store owner target is configured)
    const whatsappWebhookUrl = process.env.WHATSAPP_BOT_WEBHOOK_URL;
    const storeOwnerWhatsApp = process.env.STORE_OWNER_WHATSAPP;
    if (whatsappWebhookUrl && storeOwnerWhatsApp) {
      try {
        await fetch(whatsappWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: storeOwnerWhatsApp,
            message: formattedMessage,
            order_id: orderId,
          }),
        });
      } catch (err) {
        console.error("WhatsApp webhook dispatch error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      whatsapp_message: formattedMessage,
      whatsapp_url: `https://wa.me/?text=${encodeURIComponent(formattedMessage)}`,
    });
  } catch (error) {
    console.error("Order processing error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process order" },
      { status: 500 }
    );
  }
}
