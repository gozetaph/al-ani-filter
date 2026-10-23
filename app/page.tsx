"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatIQD } from "@/lib/utils";
import { Product, CartItem } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState<{ id: string; total: number; waUrl: string } | null>(null);

  // Checkout Fields
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custGov, setCustGov] = useState("Baghdad");
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [custArea, setCustArea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setProducts(data);
        }
      } catch {
        // Fallback to local catalog
      }
    }
    loadProducts();
  }, [supabase]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderTotal = cartSubtotal + deliveryFee;

  // Cart actions with haptic feedback
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) return;
    triggerHaptic("light");
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert("وصلت للحد الأقصى المتوفر بالمخزن.");
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    triggerHaptic("light");
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }
      if (nextQty > item.product.stock_quantity) {
        alert("أقصى كمية متوفرة حالياً بالمخزن.");
        return prev;
      }
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity: nextQty } : i));
    });
  };

  const handleGovChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    setCustGov(selectedOption.value);
    setDeliveryFee(parseInt(selectedOption.getAttribute("data-fee") || "5000"));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const orderId = "AF-" + Math.floor(1090 + Math.random() * 800);
    const itemsSummary = cart.map((i) => `${i.product.title} × ${i.quantity}`).join("، ");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          customer_name: custName,
          phone: custPhone,
          governorate: custGov,
          detailed_address: custArea,
          items_summary: itemsSummary,
          subtotal: cartSubtotal,
          shipping_fee: deliveryFee,
          total_amount: orderTotal,
        }),
      });

      const data = await res.json();
      triggerHaptic("success");

      setOrderConfirmed({
        id: orderId,
        total: orderTotal,
        waUrl: data.whatsapp_url || `https://wa.me/?text=${encodeURIComponent(`طلب جديد #${orderId}`)}`,
      });

      setCart([]);
      setIsCheckoutOpen(false);
    } catch {
      alert("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col selection:bg-[#004bb5] selection:text-white">
      
      {/* 1. CLEAN LOGO-MATCHED HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 select-none">
            <div className="h-10 px-3 bg-[#004bb5] text-white rounded-lg flex items-center justify-center font-black text-sm tracking-tight shadow-xs">
              AL ANI
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight block leading-tight">
                العاني للفلتر
              </span>
              <span className="text-[11px] text-slate-500 block">
                AL ANI Filter • بيع وصيانة فلاتر ومنظومات المياه
              </span>
            </div>
          </div>

          {/* Cart Button */}
          <button
            onClick={() => {
              triggerHaptic("light");
              setIsCartOpen(true);
            }}
            className="flex items-center gap-2 bg-[#004bb5] hover:bg-[#00388a] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>السلة</span>
            <span className="bg-white text-[#004bb5] text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          </button>

        </div>
      </header>

      {/* 2. RESTRAINED HERO SECTION */}
      <section className="bg-white border-b border-slate-200 py-10 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#004bb5] text-xs font-semibold">
            <span>✓ كفالة حقيقية وتوصيل لكافة محافظات العراق</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            أنظمة تنقية وتحلية المياه المعتمدة
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            منظومات التناضح العكسي (R.O) الأصلية، شمعات التبديل والممبرين عالي الدقة مع خدمة الدفع عند الاستلام بعد الفحص.
          </p>

          <div className="pt-2 flex items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <span>• دفع عند الاستلام (COD)</span>
            <span>• ضمان 12 شهر</span>
            <span>• فحص قبل الدفع</span>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT CATALOG */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-10 w-full">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">المنتجات المتوفرة</h2>
          <span className="text-xs text-slate-500">{products.length} مواد متاحة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((prod) => {
            const isOutOfStock = prod.stock_quantity <= 0;
            const isLowStock = prod.stock_quantity <= 3 && prod.stock_quantity > 0;

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 transition"
              >
                <div>
                  {/* Real Image Box */}
                  <div className="h-52 bg-slate-50 rounded-xl flex items-center justify-center p-3 mb-4 relative border border-slate-100">
                    <Image
                      src={prod.image_url}
                      alt={prod.title}
                      width={200}
                      height={200}
                      className="h-44 w-auto object-contain"
                    />
                    {isLowStock && (
                      <span className="absolute bottom-2 right-2 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        متبقي {prod.stock_quantity} فقط
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug mb-1">
                    {prod.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {prod.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">السعر</span>
                    <span className="text-base font-extrabold text-[#004bb5]">
                      {formatIQD(prod.price)}
                    </span>
                  </div>

                  <button
                    onClick={() => addToCart(prod)}
                    disabled={isOutOfStock}
                    className="min-h-[42px] px-4 bg-[#004bb5] hover:bg-[#00388a] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition active:scale-95 shadow-xs"
                  >
                    {isOutOfStock ? "نافد بالمخزن" : "إضافة للسلة"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 4. CART DRAWER (SLIDE-OVER) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-r border-slate-200">
            
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">سلة المشتريات</h3>
                <span className="text-xs text-slate-500">{cartCount} مواد مضافة</span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <p className="font-semibold text-sm">سلة المشتريات فارغة</p>
                  <p>اختر ما يناسبك من المنظومات والشمعات أعلاه</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.product.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={c.product.image_url}
                        alt={c.product.title}
                        width={44}
                        height={44}
                        className="w-11 h-11 object-contain rounded-lg bg-white border border-slate-200 p-0.5"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{c.product.title}</h4>
                        <span className="text-xs font-semibold text-[#004bb5]">
                          {formatIQD(c.product.price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(c.product.id, -1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold font-mono">{c.quantity}</span>
                      <button
                        onClick={() => updateQuantity(c.product.id, 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-600">المجموع الفرعي:</span>
                <span className="text-lg font-bold text-slate-900">{formatIQD(cartSubtotal)}</span>
              </div>
              <button
                disabled={cart.length === 0}
                onClick={() => {
                  triggerHaptic("light");
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full min-h-[48px] bg-[#004bb5] hover:bg-[#00388a] disabled:opacity-40 text-white font-bold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2"
              >
                <span>متابعة تثبيت الطلب (الدفع عند الاستلام)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900">تثبيت الطلب والتوصيل</h3>
                <p className="text-xs text-slate-500">الدفع نقداً عند استلام الشحنة</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله الهاشمي"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف (للتنسيق قبل الوصول) *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="0770 123 4567"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none text-right font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المحافظة *</label>
                  <select
                    onChange={handleGovChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none"
                  >
                    <option value="Baghdad" data-fee="5000">بغداد (5,000 د.ع)</option>
                    <option value="Erbil" data-fee="6000">أربيل (6,000 د.ع)</option>
                    <option value="Basra" data-fee="7000">البصرة (7,000 د.ع)</option>
                    <option value="Sulaymaniyah" data-fee="6000">السليمانية (6,000 د.ع)</option>
                    <option value="Najaf" data-fee="7000">النجف الأشرف (7,000 د.ع)</option>
                    <option value="Karbala" data-fee="7000">كربلاء المقدسة (7,000 د.ع)</option>
                    <option value="Babil" data-fee="7000">بابل / الحلة (7,000 د.ع)</option>
                    <option value="Kirkuk" data-fee="6000">كركوك (6,000 د.ع)</option>
                    <option value="Nineveh" data-fee="7000">نينوى / الموصل (7,000 د.ع)</option>
                    <option value="Anbar" data-fee="7000">الأنبار (7,000 د.ع)</option>
                    <option value="Diyala" data-fee="7000">ديالى (7,000 د.ع)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المنطقة والشارع *</label>
                  <input
                    type="text"
                    required
                    value={custArea}
                    onChange={(e) => setCustArea(e.target.value)}
                    placeholder="مثال: المنصور، شارع 14 رمضان"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#004bb5] focus:outline-none"
                  />
                </div>
              </div>

              {/* Price Calculation Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>ثمن البضاعة:</span>
                  <span className="font-semibold text-slate-900">{formatIQD(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>أجور التوصيل:</span>
                  <span className="font-semibold text-[#004bb5]">{formatIQD(deliveryFee)}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between items-baseline font-extrabold text-sm text-slate-900">
                  <span>المبلغ المطلوب نقداً (COD):</span>
                  <span className="text-[#004bb5] text-base">{formatIQD(orderTotal)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 min-h-[46px] bg-[#004bb5] hover:bg-[#00388a] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-xs text-xs"
                >
                  {isSubmitting ? "جاري التثبيت..." : "✓ تأكيد الطلب فوراً"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 6. ORDER CONFIRMATION & WHATSAPP NOTIFICATION MODAL */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              ✓
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-slate-900">تم تسجيل طلبك بنجاح!</h3>
              <p className="text-xs text-slate-500 mt-0.5">رقم الطلب الخاص بك: #{orderConfirmed.id}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-right space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">المبلغ المطلوب عند الاستلام:</span>
                <span className="font-extrabold text-[#004bb5]">{formatIQD(orderConfirmed.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className="font-bold text-emerald-700">الدفع نقداً عند الباب (COD)</span>
              </div>
            </div>

            {/* WhatsApp Notification Action */}
            <div className="space-y-2 pt-2">
              <a
                href={orderConfirmed.waUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
              >
                <span>💬 تأكيد عبر واتساب العاني للفلتر</span>
              </a>
              <button
                onClick={() => setOrderConfirmed(null)}
                className="w-full py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
              >
                العودة للتسوق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <p>محل العاني للفلتر (AL ANI Filter) • بيع وتجهيز فلاتر ومنظومات المياه • العراق</p>
      </footer>

    </div>
  );
}
