import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      customer_name,
      phone,
      governorate,
      detailed_address,
      items_summary,
      subtotal,
      shipping_fee,
      total_amount,
    } = body;

    const supabase = createClient();

    // 1. Insert into Supabase Orders table
    const { error: dbError } = await supabase.from("orders").insert([
      {
        id,
        customer_name,
        phone,
        governorate,
        detailed_address,
        payment_method: "COD",
        subtotal,
        shipping_fee,
        total_amount,
        status: "pending",
        notes: items_summary,
      },
    ]);

    if (dbError) {
      console.error("Supabase insert error:", dbError);
    }

    // 2. Prepare structured WhatsApp Bot Message
    const formattedMessage =
      `*طلب جديد من الموقع - العاني للفلتر*\n` +
      `───────────────────────\n` +
      `*رقم الطلب:* #${id}\n` +
      `*الزبون:* ${customer_name}\n` +
      `*رقم الهاتف:* ${phone}\n` +
      `*المحافظة والعنوان:* ${governorate} - ${detailed_address}\n` +
      `*المواد المطلوبة:*\n${items_summary}\n` +
      `───────────────────────\n` +
      `*المبلغ الإجمالي عند الاستلام (COD):* ${total_amount.toLocaleString()} د.ع\n` +
      `*(شامل أجور التوصيل: ${shipping_fee.toLocaleString()} د.ع)*`;

    // 3. Optional WhatsApp Webhook trigger (UltraMsg / GreenAPI / Meta Cloud API)
    const whatsappWebhookUrl = process.env.WHATSAPP_BOT_WEBHOOK_URL;
    if (whatsappWebhookUrl) {
      try {
        await fetch(whatsappWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: process.env.STORE_OWNER_WHATSAPP || phone,
            message: formattedMessage,
            order_id: id,
          }),
        });
      } catch (err) {
        console.error("WhatsApp webhook dispatch error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: id,
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
