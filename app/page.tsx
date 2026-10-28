"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatIQD } from "@/lib/utils";
import { Product, CartItem } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState<{ id: string; total: number; gov: string; waUrl: string } | null>(null);

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashRevealed, setSplashRevealed] = useState(false);
  const [splashFading, setSplashFading] = useState(false);

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Checkout Fields
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custGov, setCustGov] = useState("Baghdad");
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [custArea, setCustArea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Splash animation sequence: A in center -> slides to side -> text pops out -> fade
    const t1 = setTimeout(() => setSplashRevealed(true), 600);
    const t2 = setTimeout(() => setSplashFading(true), 2400);
    const t3 = setTimeout(() => setShowSplash(false), 3100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

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

  const categories = ["الكل", ...Array.from(new Set(products.map((p) => p.type || p.category || "أخرى")))];

  const filteredProducts = activeCategory === "الكل" 
    ? products 
    : products.filter((p) => (p.type || p.category) === activeCategory);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderTotal = cartSubtotal + deliveryFee;

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

    const orderId = "AF-" + Math.floor(1090 + Math.random() * 8000);
    const itemsSummary = cart.map((i) => `${i.product.title} × ${i.quantity}`).join("، ");

    triggerHaptic("medium");

    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          customer_name: custName,
          phone: custPhone,
          governorate: custGov,
          detailed_address: custArea,
          payment_method: "COD",
          subtotal: cartSubtotal,
          shipping_fee: deliveryFee,
          total_amount: orderTotal,
          status: "pending",
          notes: `المواد: ${itemsSummary}`,
          items: cart.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
        }),
      });
    } catch {
      // Offline fallback
    }

    const waText = encodeURIComponent(
      `مرحباً محل العاني، أود تأكيد طلبي الجديد:\n` +
      `رقم الطلب: ${orderId}\n` +
      `الاسم: ${custName}\n` +
      `المحافظة: ${custGov} - ${custArea}\n` +
      `الهاتف: ${custPhone}\n` +
      `المواد: ${itemsSummary}\n` +
      `المبلغ المطلوب نقداً: ${formatIQD(orderTotal)}`
    );

    setOrderConfirmed({
      id: orderId,
      total: orderTotal,
      gov: custGov,
      waUrl: `https://wa.me/9647700000000?text=${waText}`,
    });

    setCart([]);
    setIsCartDrawerOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col antialiased selection:bg-[#004bb5] selection:text-white pb-28 md:pb-16 relative">
      
      {/* ========================================================== */}
      {/* 1. SPLASH ANIMATION OVERLAY (A AT CENTER -> SLIDES -> TEXT) */}
      {/* ========================================================== */}
      {showSplash && (
        <div 
          className={`fixed inset-0 z-50 bg-[#004bb5] flex items-center justify-center p-6 transition-all duration-700 ease-in-out ${
            splashFading ? "opacity-0 scale-105 blur-md pointer-events-none" : "opacity-100 scale-100"
          }`}
        >
          {/* Subtle Water Glow */}
          <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-white/10 blur-3xl animate-pulse pointer-events-none" />

          {/* Center Lockup Container */}
          <div className="relative z-10 flex items-center justify-center" dir="ltr">
            {/* Mark A */}
            <div className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center shrink-0">
              <Image 
                src="/logo_a_trans.png" 
                alt="A" 
                width={130} 
                height={130} 
                className="h-20 sm:h-28 md:h-32 w-auto object-contain drop-shadow-2xl" 
                priority
              />
            </div>

            {/* Arabic Calligraphy 'العاني للفلتر' (Pops out from behind A) */}
            <div 
              className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center shrink-0 ${
                splashRevealed ? "max-w-[500px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              <Image 
                src="/logo_text_trans.png" 
                alt="العاني للفلتر" 
                width={280} 
                height={100} 
                className="h-16 sm:h-24 md:h-28 w-auto max-w-none object-contain pl-3 sm:pl-5 drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. STICKY AMAZING GLASS HEADER                             */}
      {/* ========================================================== */}
      <header className="sticky top-0 z-30 amazing-glass-nav px-4 sm:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Logo Lockup */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="flex items-center gap-2 h-10" dir="ltr">
            <Image src="/logo_a_blue_trans.png" alt="العاني" width={38} height={38} className="h-8 sm:h-9 w-auto object-contain" />
            <Image src="/logo_text_blue_trans.png" alt="للفلتر" width={110} height={34} className="h-7 sm:h-8 w-auto object-contain" />
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a 
            href="tel:0770000000" 
            className="amazing-glass-pill text-[#18181B] px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 font-mono cursor-pointer" 
            dir="ltr"
          >
            <svg className="w-3.5 h-3.5 text-[#004bb5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>077xxxxxx</span>
          </a>

          <button 
            onClick={() => {
              triggerHaptic("light");
              setIsCartDrawerOpen(true);
            }} 
            className="amazing-glass-pill text-zinc-900 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 cursor-pointer active:scale-95 transition"
          >
            <svg className="w-3.5 h-3.5 text-[#004bb5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>السلة</span>
            <span className="bg-[#004bb5] text-white w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-black">
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      {/* ========================================================== */}
      {/* 3. MINIMAL EDITORIAL HERO (REFERENCE #1)                   */}
      {/* ========================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-5 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs font-semibold text-zinc-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>محل العاني للفلتر • بغداد (توصيل لكافة المحافظات)</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-[#18181B] tracking-tight leading-tight sm:leading-tight">
              أنظمة تحلية وتنقية المياه المعتمدة
            </h1>

            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xl font-normal">
              منظومات التناضح العكسي (R.O)، شمعات التبديل والممبرين عالي الدقة. فحص ومعاينة الطرد عند الباب مع كفالة حقيقية والدفع نقداً عند الاستلام.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a 
                href="#catalogSection" 
                className="bg-[#004bb5] hover:bg-[#003685] text-white px-6 py-3 rounded-full text-xs sm:text-sm font-bold shadow-md transition active:scale-95 flex items-center gap-2"
              >
                <span>تصفح المواد المتوفرة</span>
                <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
              <a 
                href="tel:0770000000" 
                className="amazing-glass-pill hover:bg-white text-zinc-800 px-5 py-3 rounded-full text-xs sm:text-sm font-bold transition flex items-center gap-2"
              >
                <span>استفسار مباشر: 077xxxxxx</span>
              </a>
            </div>

            <div className="pt-6 border-t border-black/[0.06] grid grid-cols-3 gap-4 max-w-md">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#004bb5] font-mono">07</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 font-semibold mt-0.5">مراحل تنقية R.O</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-800 font-mono">100%</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 font-semibold mt-0.5">فحص قبل الدفع</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-zinc-800 font-mono">18</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 font-semibold mt-0.5">محافظة توصيل</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md amazing-glass-card rounded-3xl p-6 sm:p-8 flex flex-col items-center">
              <div className="absolute top-4 right-4 bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                منظومة متكاملة
              </div>

              <div className="h-64 sm:h-72 w-full flex items-center justify-center p-2">
                <Image 
                  src="/products/ro-system.jpg" 
                  alt="منظومة تحلية مياه 7 مراحل" 
                  width={340} 
                  height={340} 
                  className="h-full w-auto object-contain drop-shadow-md"
                  priority 
                />
              </div>

              <div className="w-full mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 block">منظومة 7 مراحل R.O</span>
                  <span className="text-[11px] text-zinc-500">خزان ضغط ومضخة كورية</span>
                </div>
                <span className="text-sm font-extrabold text-[#004bb5] font-mono">185,000 د.ع</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================== */}
      {/* 4. PRODUCT CATALOG (AMAZING GLASS CARDS & GLOW)            */}
      {/* ========================================================== */}
      <section id="catalogSection" className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full">
        
        <div className="space-y-4 mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900">المواد والقطع المتوفرة</h2>
            <p className="text-xs text-zinc-500 mt-0.5">اختر المادة وأضفها للسلة للدفع عند الاستلام</p>
          </div>

          {/* Dynamic Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => {
              const isActive = cat === activeCategory;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveCategory(cat);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive ? "amazing-glass-pill-active" : "amazing-glass-pill text-zinc-800"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Responsive Grid: 2 Columns on Mobile, 4 Columns on Laptop */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map((prod) => (
            <div 
              key={prod.id} 
              className="amazing-glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="h-38 sm:h-52 amazing-glass-inner rounded-xl sm:rounded-2xl flex items-center justify-center p-3 mb-3 relative overflow-hidden">
                  <span className="absolute top-2.5 right-2.5 amazing-glass-pill text-zinc-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {prod.type || prod.badge || "متوفر"}
                  </span>
                  <Image 
                    src={prod.image_url} 
                    alt={prod.title} 
                    width={200} 
                    height={200} 
                    className="h-32 sm:h-44 w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm" 
                  />
                </div>

                <h3 className="font-bold text-xs sm:text-base text-zinc-900 leading-snug line-clamp-2 mb-1">
                  {prod.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-500 leading-relaxed line-clamp-2">
                  {prod.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-sm sm:text-base font-extrabold text-[#004bb5] font-mono">
                  {formatIQD(prod.price)}
                </span>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(prod);
                  }} 
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl amazing-glass-btn text-zinc-800 transition flex items-center justify-center font-bold text-base active:scale-90 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ========================================================== */}
      {/* 5. INTERACTIVE FAQ ACCORDION (REFERENCE #3)                 */}
      {/* ========================================================== */}
      <section className="max-w-4xl mx-auto px-4 sm:px-8 py-14 w-full">
        <div className="text-center space-y-2 mb-8">
          <h3 className="text-xl sm:text-2xl font-black text-zinc-900">أسئلة شائعة قبل الطلب</h3>
          <p className="text-xs sm:text-sm text-zinc-500">كل ما تحتاج معرفته عن التوصيل، الضمان، وطريقة الدفع</p>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 1,
              q: "كم يستغرق التوصيل إلى محافظتي؟",
              a: "يتم شحن الطلبات يومياً من محلنا في بغداد. التوصيل داخل بغداد يستغرق 24 إلى 48 ساعة، ولكافة المحافظات الأخرى من 2 إلى 4 أيام عمل.",
            },
            {
              id: 2,
              q: "هل الدفع عند الاستلام أم إلكتروني؟",
              a: "الدفع نقداً عند الباب بعد استلام الطرد وفحصه بنفسك. لا نطلب أي دفع مسبق.",
            },
            {
              id: 3,
              q: "هل المنظومات أصلية ومشمولة بالضمان؟",
              a: "نعم، كافة المنظومات مستوردة بمواصفات معتمدة ومطابقة للمياه العراقية، مع كفالة حقيقية لمدة 12 شهراً، وتوفر كافة شمعات التبديل وقطع الغيار الأصلية دائماً.",
            },
            {
              id: 4,
              q: "متى أحتاج إلى تبديل شمعات الفلتر؟",
              a: "المراحل الثلاث الأولى تُبدل عادة كل 3 إلى 4 أشهر، بينما غشاء الممبرين ومرحلة البوست كاربون تُبدل كل 12 إلى 18 شهراً حسب معدل الاستهلاك ونسبة ملوحة الماء.",
            },
          ].map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <div key={faq.id} className="amazing-glass-card rounded-2xl overflow-hidden">
                <button 
                  onClick={() => {
                    triggerHaptic("light");
                    setOpenFaq(isOpen ? null : faq.id);
                  }}
                  className="w-full p-4 sm:p-5 text-right font-bold text-xs sm:text-sm text-zinc-900 flex items-center justify-between cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-zinc-400 font-mono text-base">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================== */}
      {/* 6. CLEAN SHOP FOOTER                                       */}
      {/* ========================================================== */}
      <footer className="mt-auto border-t border-black/[0.06] bg-white py-10 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3" dir="ltr">
            <Image src="/logo_a_blue_trans.png" alt="A" width={24} height={24} className="h-6 w-auto object-contain" />
            <span className="font-bold text-zinc-800">محل العاني للفلتر • بغداد، العراق</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-500">
            <span>توصيل لكافة المحافظات</span>
            <span>•</span>
            <span>الدفع نقداً عند الاستلام</span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-zinc-400 hover:text-zinc-800 transition text-[11px] font-semibold">
              ⚙️ لوحة الإدارة
            </Link>
          </div>
        </div>
      </footer>

      {/* ========================================================== */}
      {/* 7. MOBILE FLOATING CART BAR (LIQUID GLASS CAPSULE)         */}
      {/* ========================================================== */}
      {cartCount > 0 && (
        <div className="fixed bottom-5 inset-x-0 z-30 flex justify-center px-4 transition-all duration-300">
          <button 
            onClick={() => {
              triggerHaptic("light");
              setIsCartDrawerOpen(true);
            }} 
            className="amazing-glass-floating rounded-full px-5 py-3.5 flex items-center justify-between gap-6 active:scale-95 transition-all w-full max-w-md cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#004bb5] text-white flex items-center justify-center font-black text-xs shadow-md">
                <span>{cartCount}</span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-zinc-900">سلة الشراء</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black text-[#004bb5] font-mono">
                {formatIQD(cartSubtotal)}
              </span>
              <svg className="w-4 h-4 text-zinc-700 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* 8. NATIVE BOTTOM SHEET DRAWER (CART & CHECKOUT)            */}
      {/* ========================================================== */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="flex-1" onClick={() => setIsCartDrawerOpen(false)} />

          <div className="w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] border-t border-black/[0.08]">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto my-3 cursor-pointer" onClick={() => setIsCartDrawerOpen(false)} />

            <div className="px-5 pb-3 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">سلة طلبك</h3>
                <p className="text-xs text-zinc-400">تأكيد المواد والتوصيل المباشر</p>
              </div>
              <button 
                onClick={() => setIsCartDrawerOpen(false)} 
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  السلة فارغة حالياً.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <Image 
                        src={item.product.image_url} 
                        alt={item.product.title} 
                        width={48} 
                        height={48} 
                        className="w-12 h-12 object-contain bg-white rounded-xl p-1 border" 
                      />
                      <div>
                        <h4 className="font-bold text-xs text-zinc-900 line-clamp-1">{item.product.title}</h4>
                        <span className="text-xs text-[#004bb5] font-mono font-bold">{formatIQD(item.product.price)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border text-xs font-bold active:scale-90">-</button>
                      <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-white border text-xs font-bold active:scale-90">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Governorate and Checkout Form */}
            {cart.length > 0 && (
              <form onSubmit={handlePlaceOrder} className="p-4 bg-zinc-50 border-t border-zinc-200 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">المحافظة *</label>
                    <select value={custGov} onChange={handleGovChange} className="w-full bg-white border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold">
                      <option value="Baghdad" data-fee="5000">بغداد (5,000 د.ع)</option>
                      <option value="Basra" data-fee="7000">البصرة (7,000 د.ع)</option>
                      <option value="Erbil" data-fee="6000">أربيل (6,000 د.ع)</option>
                      <option value="Sulaymaniyah" data-fee="6000">السليمانية (6,000 د.ع)</option>
                      <option value="Najaf" data-fee="7000">النجف (7,000 د.ع)</option>
                      <option value="Karbala" data-fee="7000">كربلاء (7,000 د.ع)</option>
                      <option value="Babil" data-fee="7000">بابل (7,000 د.ع)</option>
                      <option value="Kirkuk" data-fee="6000">كركوك (6,000 د.ع)</option>
                      <option value="Nineveh" data-fee="7000">نينوى (7,000 د.ع)</option>
                      <option value="Anbar" data-fee="7000">الأنبار (7,000 د.ع)</option>
                      <option value="Diyala" data-fee="7000">ديالى (7,000 د.ع)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">رقم الهاتف *</label>
                    <input 
                      type="tel" 
                      required 
                      value={custPhone} 
                      onChange={(e) => setCustPhone(e.target.value)} 
                      placeholder="0770 123 4567" 
                      dir="ltr" 
                      className="w-full bg-white border border-zinc-300 rounded-xl p-2.5 text-xs text-right font-mono" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1 text-xs">الاسم والمنطقة بالتفصيل *</label>
                  <input 
                    type="text" 
                    required 
                    value={custArea} 
                    onChange={(e) => setCustArea(e.target.value)} 
                    placeholder="الاسم الكامل، المنطقة، أقرب نقطة دالة" 
                    className="w-full bg-white border border-zinc-300 rounded-xl p-2.5 text-xs" 
                  />
                </div>

                <div className="flex justify-between items-baseline pt-1 text-xs">
                  <span className="text-zinc-500">المجموع شامل التوصيل:</span>
                  <span className="text-lg font-black text-[#004bb5]">{formatIQD(orderTotal)}</span>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full min-h-[48px] bg-[#004bb5] hover:bg-[#003685] text-white font-bold rounded-xl text-sm transition shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSubmitting ? "جاري التثبيت..." : "✓ تأكيد الطلب نقداً عند الاستلام"}</span>
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 9. ORDER CONFIRMATION MODAL                                */}
      {/* ========================================================== */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-black/[0.08]">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-900">تم تأكيد طلبك بنجاح!</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                سنتصل بك لتأكيد الشحن. الدفع نقداً عند الاستلام بعد فحص المواد.
              </p>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-3 text-xs text-zinc-700 font-mono space-y-1">
              <div>كود الطلب: <b>{orderConfirmed.id}</b></div>
              <div>المحافظة: {orderConfirmed.gov}</div>
              <div>المطلوب نقداً: <b>{formatIQD(orderConfirmed.total)}</b></div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a 
                href={orderConfirmed.waUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <span>متابعة الطلب عبر واتساب 💬</span>
              </a>
              <button 
                onClick={() => setOrderConfirmed(null)} 
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
