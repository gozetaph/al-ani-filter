"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatIQD } from "@/lib/utils";
import { Product, CartItem } from "@/lib/types";
import { initialProducts } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

export default function HalcyonStorefrontPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [orderConfirmed, setOrderConfirmed] = useState<{ id: string; total: number; gov: string; waUrl: string } | null>(null);

  // Live Baghdad Clock
  const [baghdadTime, setBaghdadTime] = useState("");

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Checkout Fields
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custGov, setCustGov] = useState("بغداد");
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [custArea, setCustArea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Update live Baghdad time
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Baghdad",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      };
      setBaghdadTime(new Intl.DateTimeFormat("en-US", options).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
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
          // Merge with mock specs if needed
          const enriched = data.map((d) => {
            const mock = initialProducts.find((m) => m.slug === d.slug || m.id === d.id);
            return {
              ...d,
              spec_table: d.spec_table || mock?.spec_table,
              part_number: d.part_number || mock?.part_number,
              subtitle: d.subtitle || mock?.subtitle,
              clean_type: d.clean_type || mock?.clean_type,
            };
          });
          setProducts(enriched);
        }
      } catch {
        // Fallback to local catalog
      }
    }
    loadProducts();
  }, [supabase]);

  const categories = [
    "الكل",
    "فلاتر دهن (زيت)",
    "فلاتر هواء",
    "فلاتر مجفف هواء للشاحنات",
    "فلاتر وقود (ديزل)",
    "فلاتر فاصل ماء وسبيتر",
    "فلاتر كابينة ومكيف"
  ];

  const filteredProducts = products.filter((prod) => {
    const matchesCategory =
      activeCategory === "الكل" ||
      (prod.type || prod.category || "").includes(activeCategory.replace("فلاتر ", ""));

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      prod.title.toLowerCase().includes(query) ||
      (prod.part_number && prod.part_number.toLowerCase().includes(query)) ||
      (prod.description && prod.description.toLowerCase().includes(query)) ||
      (prod.type && prod.type.toLowerCase().includes(query)) ||
      (prod.slug && prod.slug.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderTotal = cartSubtotal + deliveryFee;

  const addToCart = (product: Product, quantity = 1) => {
    if (product.stock_quantity <= 0) return;
    triggerHaptic("light");
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { product, quantity }];
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
      waUrl: `https://wa.me/9647901526221?text=${waText}`,
    });

    setCart([]);
    setIsCartDrawerOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#111111] flex flex-col antialiased selection:bg-[#111111] selection:text-white">
      
      {/* ========================================================== */}
      {/* 1. HALCYON TOP ANNOUNCEMENT BAR (Height ~37px)             */}
      {/* ========================================================== */}
      <div className="bg-[#111111] text-white text-[11px] sm:text-xs font-mono-code px-4 sm:px-8 py-2 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>بغداد {baghdadTime || "04:55 AM"} • مفتوح للطلبات</span>
          <span className="hidden md:inline text-neutral-400">| شحن لكافة المحافظات 18 والدفع عند الاستلام</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-300">
          <a href="tel:+9647901526221" className="hover:text-white transition">0790 152 6221</a>
          <span className="hidden sm:inline text-neutral-600">/</span>
          <a href="tel:+9647710077880" className="hidden sm:inline hover:text-white transition">0771 007 7880</a>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. HALCYON MAIN NAVBAR (Height: 48px desktop / 44px mobile) */}
      {/* ========================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-8 h-12 flex items-center justify-between transition-all">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 text-neutral-800 hover:text-black focus:outline-none"
            aria-label="القائمة"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2.5 group">
            <Image 
              src="/logo_a_blue_trans.png" 
              alt="العاني" 
              width={28} 
              height={28} 
              className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105" 
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-[#111111]">
                محل العاني للفلتر
              </span>
              <span className="text-[9px] font-mono-code text-neutral-500 uppercase tracking-wider">
                ASAS FILTER AGENCY
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-semibold tracking-normal text-neutral-700">
          <a href="#catalog" className="hover:text-black transition">كتالوج الفلاتر (80)</a>
          <a href="#oem-lookup" className="hover:text-black transition">مطابقة OEM</a>
          <a href="#features" className="hover:text-black transition">الوكالة والمواصفات</a>
          <a href="#faq" className="hover:text-black transition">الأسئلة الشائعة</a>
          <Link href="/admin" className="text-neutral-500 hover:text-black font-mono-code text-[11px] transition">
            [لوحة الإدارة]
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => {
              const input = document.getElementById("catalogSearchInput");
              input?.focus();
            }}
            className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black px-2.5 py-1.5 rounded border border-transparent hover:border-neutral-200 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="font-mono-code text-[11px]">بحث</span>
          </button>

          {/* Cart Bag with Halcyon Mono Counter */}
          <button 
            onClick={() => {
              triggerHaptic("light");
              setIsCartDrawerOpen(true);
            }} 
            className="flex items-center gap-2 bg-[#111111] text-white px-3 sm:px-4 py-1.5 rounded-none text-xs font-semibold hover:bg-neutral-800 transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="hidden sm:inline">السلة</span>
            <span className="font-mono-code text-[11px] font-bold bg-white text-black px-1.5 py-0.2 rounded-xs">
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[85px] z-30 bg-white border-b border-neutral-200 shadow-xl px-6 py-6 flex flex-col gap-4 animate-fadeIn">
          <div className="flex flex-col gap-3 font-semibold text-sm">
            <a 
              href="#catalog" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100 flex items-center justify-between"
            >
              <span>كتالوج الفلاتر الكامل</span>
              <span className="font-mono-code text-xs text-neutral-400">80 قطعة</span>
            </a>
            <a 
              href="#oem-lookup" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100"
            >
              مطابقة أرقام OEM والشركات
            </a>
            <a 
              href="#faq" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100"
            >
              الأسئلة الشائعة والشحن
            </a>
            <Link 
              href="/admin" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 text-[#004bb5] font-mono-code text-xs"
            >
              دخول الإدارة [PIN]
            </Link>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <a 
              href="https://wa.me/9647901526221" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full text-center py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-none"
            >
              تواصل عبر واتساب المباشر
            </a>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 3. HALCYON EDITORIAL HERO SECTION ("Good Light." Style)     */}
      {/* ========================================================== */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-8 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-1 bg-neutral-50 text-[11px] font-mono-code text-neutral-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>ASAS GENUINE AUTOMOTIVE & INDUSTRIAL FILTRATION</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#111111] leading-[1.08]">
                GOOD FILTRATION.
                <span className="block text-2xl sm:text-4xl lg:text-5xl font-bold text-neutral-500 mt-2">
                  فلاتر أصلية. أداء يدوم لأقسى الظروف.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">
                في محل العاني نوفر منظومة ترشيح أصلية متكاملة للسيارات والشاحنات والمولدات والمعدات الثقيلة. وكالة فلاتر أساس <span className="font-bold text-black">ASAS</span> التركية المعتمدة في العراق مع مطابقة هندسية دقيقة لمواصفات المصنع OEM وفحص الطرد قبل الدفع لكافة المحافظات الـ 18.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a 
                  href="#catalog" 
                  className="halcyon-btn-primary px-7 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2"
                >
                  <span>استعراض الفلاتر المتوفرة</span>
                  <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
                
                <a 
                  href="#oem-lookup" 
                  className="halcyon-btn-outline px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider"
                >
                  مطابقة كود OEM
                </a>
              </div>
            </div>

            {/* Right: Technical Hero Spec Box */}
            <div className="lg:col-span-4 bg-[#f4f4f4] border border-neutral-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
                <span className="font-mono-code text-xs uppercase font-bold text-neutral-600">SPECIFICATION SUMMARY</span>
                <span className="text-[10px] font-mono-code bg-black text-white px-2 py-0.5">OEM CERTIFIED</span>
              </div>
              <div className="space-y-3 font-mono-code text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-200">
                  <span className="text-neutral-500">الوكالة:</span>
                  <span className="font-bold text-neutral-900">ASAS Turkey (أساس)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200">
                  <span className="text-neutral-500">الموديلات المتوفرة:</span>
                  <span className="font-bold text-neutral-900">80+ موديل فوري</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200">
                  <span className="text-neutral-500">المطابقة:</span>
                  <span className="font-bold text-neutral-900">Mann, Donaldson, Fleetguard</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200">
                  <span className="text-neutral-500">التوصيل والمعاينة:</span>
                  <span className="font-bold text-neutral-900">كافة محافظات العراق 18</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">طريقة الدفع:</span>
                  <span className="font-bold text-neutral-900">نقداً عند الاستلام (COD)</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Halcyon 3-Column Stats Strip */}
        <div className="border-t border-neutral-200 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-neutral-200 bg-white">
          <div className="p-6 text-center">
            <span className="block text-2xl font-mono-code font-black text-black">80+</span>
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">فلتر ترشيح أصلي جاهز للشحن</span>
          </div>
          <div className="p-6 text-center">
            <span className="block text-2xl font-mono-code font-black text-black">100%</span>
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">مطابقة مواصفات المصنع OEM</span>
          </div>
          <div className="p-6 text-center">
            <span className="block text-2xl font-mono-code font-black text-black">18 محافظة</span>
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">توصيل سريع مع فحص الطرد</span>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* 4. HALCYON TABBED COLLECTION & SEARCH (Clean Grid Layout)  */}
      {/* ========================================================== */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-8 py-12 w-full flex-1">
        
        {/* Controls Bar */}
        <div className="bg-white border border-neutral-200 p-4 sm:p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="catalogSearchInput"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم القطعة (مثل SP 1450 أو CF 233) أو نوع الآلية (اكتروس، لاندكروزر، بيركنز)..."
              className="w-full pr-10 pl-10 py-2.5 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-black focus:outline-none transition rounded-none font-mono-code placeholder:font-sans placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-neutral-400 hover:text-black font-mono-code"
              >
                مسح
              </button>
            )}
          </div>

          <div className="shrink-0 font-mono-code text-xs text-neutral-500 flex items-center gap-2">
            <span>النتائج:</span>
            <span className="font-bold text-black">{filteredProducts.length}</span>
            <span>من أصل {products.length}</span>
          </div>
        </div>

        {/* Halcyon Horizontal Category Tabs */}
        <div className="border-b border-neutral-200 mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 sm:gap-2 min-w-max pb-1">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveCategory(cat);
                  }}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all relative ${
                    isActive 
                      ? "text-black border-b-2 border-black font-bold" 
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================== */}
        {/* 5. PRODUCT GRID (Halcyon boost-sd Product Cards)           */}
        {/* ========================================================== */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-neutral-200 p-12 text-center space-y-4">
            <svg className="w-12 h-12 mx-auto text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-base font-bold text-neutral-800">لا توجد فلاتر مطابقة لبحثك</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              جرب البحث برقم آخر، أو تواصل معنا مباشرة عبر واتساب وسيقوم الفني بالتحقق من رقم القطعة المطلوب وتوفيره لك.
            </p>
            <button 
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("الكل");
              }}
              className="halcyon-btn-outline px-5 py-2 text-xs font-bold"
            >
              إعادة تعيين البحث
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product) => {
              const partNumber = product.part_number || product.title.split(" ").pop() || "ASAS";
              const cleanType = product.clean_type || product.type?.replace(/^فلاتر\s+/, "فلتر ") || "فلتر أصلي";
              
              return (
                <div 
                  key={product.id}
                  className="bg-white border border-neutral-200 group flex flex-col justify-between hover:border-black transition-all duration-300 relative"
                >
                  {/* Top Image Container */}
                  <div 
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductQty(1);
                    }}
                    className="aspect-square bg-white p-4 relative overflow-hidden flex items-center justify-center cursor-pointer border-b border-neutral-100"
                  >
                    <Image
                      src={product.image_url || "/products/oil-filter.svg"}
                      alt={product.title}
                      width={500}
                      height={500}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />

                    {/* Part Number Badge */}
                    {product.badge && (
                      <span className="absolute top-2.5 right-2.5 bg-neutral-900 text-white text-[9px] sm:text-[10px] font-mono-code px-2 py-0.5 tracking-wider uppercase">
                        {product.badge}
                      </span>
                    )}

                    <span className="absolute bottom-2 left-2 text-[10px] font-mono-code text-neutral-400 group-hover:text-black transition">
                      [المواصفات +]
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3 text-right">
                    <div className="space-y-1">
                      <span className="text-[10px] sm:text-[11px] font-mono-code text-neutral-500 uppercase block">
                        {cleanType}
                      </span>
                      
                      {/* Bold Part Number */}
                      <h3 
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductQty(1);
                        }}
                        className="font-black text-sm sm:text-base text-[#111111] font-mono-code cursor-pointer hover:underline tracking-tight"
                      >
                        {partNumber}
                      </h3>

                      <p className="text-[11px] text-neutral-600 line-clamp-1">
                        {product.title}
                      </p>
                    </div>

                    {/* Price and Add Button */}
                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <div className="font-mono-code font-bold text-xs sm:text-sm text-black">
                        {formatIQD(product.price)}
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className="bg-black text-white hover:bg-neutral-800 text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-none transition active:scale-95 shrink-0"
                      >
                        + إضافة
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================== */}
      {/* 6. TECHNICAL OEM LOOKUP SECTION                            */}
      {/* ========================================================== */}
      <section id="oem-lookup" className="bg-white border-y border-neutral-200 py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <span className="font-mono-code text-xs uppercase tracking-wider text-neutral-500">
            OEM CROSS REFERENCE DIRECTORY
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-black">
            مطابقة جميع أرقام القطع الأصلية OEM
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            نوفر بدائل هندسية مطابقة تماماً لمواصفات شركات الفلاتر العالمية (Mann Filter, Donaldson, Fleetguard, Baldwin, Bosch, Wix). أرسل لنا رقم القطعة المسجل على الفلتر القديم وسنوفر لك الفلتر المطابق فوراً.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4 font-mono-code text-xs">
            <div className="p-3 border border-neutral-200 bg-neutral-50">MANN FILTER</div>
            <div className="p-3 border border-neutral-200 bg-neutral-50">FLEETGUARD</div>
            <div className="p-3 border border-neutral-200 bg-neutral-50">DONALDSON</div>
            <div className="p-3 border border-neutral-200 bg-neutral-50">BALDWIN FILTERS</div>
          </div>

          <div className="pt-4">
            <a 
              href="https://wa.me/9647901526221?text=مرحباً، أود الاستفسار عن مطابقة فلتر لرقم القطعة OEM التالي: " 
              target="_blank"
              rel="noopener noreferrer"
              className="halcyon-btn-primary px-8 py-3.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <span>استعلام برقم القطعة عبر واتساب</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.698.077-1.116-.062-.26-.086-.594-.216-1.026-.406-1.808-.795-2.984-2.617-3.076-2.739-.088-.121-.734-.977-.734-1.86 0-.884.464-1.32.63-1.498.167-.179.365-.224.487-.224.122 0 .243.001.35.006.112.006.262-.043.41.312.152.365.518 1.265.564 1.357.045.091.076.197.015.318-.061.121-.091.197-.182.303-.091.107-.193.238-.276.321-.091.091-.186.19-.08.373.107.182.474.782 1.018 1.267.701.624 1.292.818 1.474.909.182.091.289.076.395-.046.107-.121.456-.532.578-.715.121-.182.243-.152.41-.091.167.061 1.062.502 1.244.593.182.091.304.137.35.213.045.076.045.441-.099.846z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* 7. HALCYON FAQ ACCORDION                                   */}
      {/* ========================================================== */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-8 py-16 w-full">
        <div className="text-center space-y-2 mb-10">
          <span className="font-mono-code text-xs text-neutral-500 uppercase tracking-wider">FREQUENTLY ASKED QUESTIONS</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-black">أسئلة شائعة قبل الطلب</h2>
        </div>

        <div className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
          {[
            {
              q: "كيف أتأكد من أن الفلتر يطابق سيارتي أو مولدتي أو آليتي بالضبط؟",
              a: "بإمكانك التحقق من خلال كود الفلتر المسجل على القطعة القديمة (مثل SP 1450 أو كود OEM للمصنع)، أو بمجرد إرسال نوع المحرك وسنة الصنع إلى فني المحل عبر واتساب ليقوم بتأكيد المطابقة الفورية."
            },
            {
              q: "هل فلاتر أساس ASAS أصلية ومعتمدة؟",
              a: "نعم، جميع فلاتر أساس مستوردة رسمياً من المصنع الأصلي في تركيا بمواصفات تصنيع قياسية OEM ومطابقة لأعلى معايير كفاءة التدفق وحبس الشوائب وحماية المحرك."
            },
            {
              q: "ما هي سياسة المعاينة والدفع عند الاستلام (COD)؟",
              a: "نوفر خدمة الفحص والمعاينة عند باب منزلك أو ورشتك قبل تسليم أي مبلغ للمندوب. يحق لك فتح الصندوق والتأكد من مطابقة كود الفلتر وسلامته ثم الدفع نقداً."
            },
            {
              q: "كم يستغرق التوصيل لكافة المحافظات؟",
              a: "يتم تسليم الطرود داخل بغداد خلال 24 إلى 48 ساعة، ولجميع المحافظات العراقية الأخرى من يومين إلى 4 أيام عمل كحد أقصى."
            }
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-4 px-4 sm:px-6">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-right text-sm sm:text-base font-bold text-neutral-900 gap-4"
                >
                  <span>{item.q}</span>
                  <span className="font-mono-code text-lg text-neutral-400 shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-neutral-600 leading-relaxed text-right pl-4">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================== */}
      {/* 8. HALCYON 4-COLUMN ARCHITECTURAL FOOTER                   */}
      {/* ========================================================== */}
      <footer className="bg-white border-t border-neutral-200 mt-auto text-neutral-700 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-right">
            
            {/* Col 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image src="/logo_a_blue_trans.png" alt="العاني" width={30} height={30} className="h-7 w-auto object-contain" />
                <span className="font-black text-sm text-black">محل العاني للفلتر</span>
              </div>
              <p className="text-neutral-500 leading-relaxed text-xs">
                بغداد، العراق • متخصصون في فلاتر المحركات الأصلية، الشاحنات، والمعدات الثقيلة. وكالة فلاتر أساس ASAS المعتمدة.
              </p>
              <div className="font-mono-code text-[11px] text-neutral-400">
                AUTHORIZED ASAS DISTRIBUTOR
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-2">
              <span className="font-mono-code font-bold text-black uppercase tracking-wider block mb-3">
                أقسام الفلاتر
              </span>
              <ul className="space-y-2 text-neutral-600">
                <li><a href="#catalog" className="hover:text-black transition">فلاتر دهن وزيت (Spin-on & Element)</a></li>
                <li><a href="#catalog" className="hover:text-black transition">فلاتر هواء سيارات ومعدات</a></li>
                <li><a href="#catalog" className="hover:text-black transition">فلاتر مجفف هواء للشاحنات</a></li>
                <li><a href="#catalog" className="hover:text-black transition">فلاتر وقود ديزل وسبيتر</a></li>
                <li><a href="#catalog" className="hover:text-black transition">فلاتر كابينة وتكييف</a></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="space-y-3">
              <span className="font-mono-code font-bold text-black uppercase tracking-wider block mb-3">
                الاتصال والطلبات
              </span>
              <div className="space-y-2">
                <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-1">
                  <span className="text-[10px] text-neutral-400 font-mono-code block">الرقم الأساسي / واتساب:</span>
                  <a href="tel:+9647901526221" className="font-mono-code font-bold text-black text-sm block hover:underline" dir="ltr">
                    +964 790 152 6221
                  </a>
                </div>
                <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-1">
                  <span className="text-[10px] text-neutral-400 font-mono-code block">الرقم الثاني / اتصال:</span>
                  <a href="tel:+9647710077880" className="font-mono-code font-bold text-black text-sm block hover:underline" dir="ltr">
                    +964 771 007 7880
                  </a>
                </div>
              </div>
            </div>

            {/* Col 4 */}
            <div className="space-y-3">
              <span className="font-mono-code font-bold text-black uppercase tracking-wider block mb-3">
                التغطية والخدمة
              </span>
              <p className="text-neutral-500 text-xs leading-relaxed">
                توصيل سريع لكافة محافظات العراق الـ 18: بغداد، البصرة، نينوى، أربيل، كركوك، النجف، كربلاء، وباقي المحافظات مع المعاينة عند الاستلام.
              </p>
              <div className="pt-2">
                <Link href="/admin" className="inline-block text-xs font-mono-code text-neutral-600 hover:text-black border border-neutral-300 px-3 py-1.5 transition">
                  لوحة إدارة الطلبات [PIN]
                </Link>
              </div>
            </div>

          </div>

          <div className="border-t border-neutral-200 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-code text-[11px] text-neutral-400">
            <div>
              © 2026 محل العاني للفلتر • AL ANI FILTER • BAGHDAD, IRAQ
            </div>
            <div>
              CASH ON DELIVERY (COD) • ALL 18 GOVERNORATES
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================== */}
      {/* 9. HALCYON PRODUCT DETAIL VIEW (Pic 2, 3, 4 Exact Layout)   */}
      {/* ========================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto flex items-start justify-center p-0 sm:p-6">
          <div className="bg-white border-0 sm:border border-neutral-300 max-w-2xl w-full min-h-screen sm:min-h-0 sm:max-h-[92vh] overflow-y-auto text-right p-5 sm:p-8 relative space-y-6 shadow-2xl">
            
            {/* Top Bar with Back Button (Halcyon Style) */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <button 
                onClick={() => setSelectedProduct(null)}
                className="inline-flex items-center gap-1.5 text-xs font-mono-code font-bold text-neutral-700 hover:text-black px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 transition"
              >
                <span>&lt; BACK</span>
                <span className="font-sans text-[11px] text-neutral-500">(العودة للكتالوج)</span>
              </button>

              <button 
                onClick={() => setSelectedProduct(null)}
                className="text-neutral-400 hover:text-black font-mono-code text-xs"
              >
                [✕ إغلاق]
              </button>
            </div>

            {/* Product Header & Hero Image */}
            <div className="space-y-6">
              
              {/* Product Gallery Container */}
              <div className="aspect-square bg-[#fbfbfb] border border-neutral-200 p-6 sm:p-8 flex items-center justify-center relative">
                <Image
                  src={selectedProduct.image_url || "/products/oil-filter.svg"}
                  alt={selectedProduct.title}
                  width={600}
                  height={600}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>

              {/* Gallery Thumbnails (Halcyon Style) */}
              <div className="flex items-center justify-center gap-2">
                <div className="w-12 h-12 border-2 border-black bg-white p-1 flex items-center justify-center cursor-pointer">
                  <Image src={selectedProduct.image_url || "/products/oil-filter.svg"} alt="1" width={40} height={40} className="w-full h-full object-contain" />
                </div>
                <div className="w-12 h-12 border border-neutral-200 bg-neutral-50 p-1 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100">
                  <Image src={selectedProduct.image_url || "/products/oil-filter.svg"} alt="2" width={40} height={40} className="w-full h-full object-contain rotate-90" />
                </div>
              </div>

              {/* Product Code Header (Like X980 in Pic 2) */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <h1 className="text-3xl sm:text-5xl font-black font-mono-code text-black tracking-tight">
                  {selectedProduct.part_number || selectedProduct.title.split(" ").pop()}
                </h1>

                <p className="text-sm sm:text-base font-semibold text-neutral-700 leading-snug">
                  {selectedProduct.subtitle || selectedProduct.title}
                </p>

                {/* Live In-Stock Indicator (Like 🟢 84 IN AKL in Pic 2) */}
                <div className="flex flex-wrap items-center gap-3 pt-2 font-mono-code text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>متوفر في مخزن بغداد (25 قطعة)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-neutral-50 text-neutral-800 border border-neutral-200 px-2.5 py-1">
                    <span className="w-2 h-2 rounded-full bg-neutral-500" />
                    <span>توصيل سريع لـ 18 محافظة</span>
                  </span>
                </div>
              </div>

              {/* Price & Quantity & Action Controls (Like Pic 3) */}
              <div className="pt-4 border-t border-neutral-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono-code text-xs text-neutral-500">السعر النقدي للقطعة:</span>
                  <span className="font-mono-code text-2xl sm:text-3xl font-black text-black">
                    {formatIQD(selectedProduct.price)}
                  </span>
                </div>

                {/* Quantity Stepper + Add Button */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-neutral-300 font-mono-code text-sm h-12 bg-white">
                    <button 
                      onClick={() => setProductQty(Math.max(1, productQty - 1))} 
                      className="px-3.5 h-full hover:bg-neutral-100 transition text-lg"
                    >
                      −
                    </button>
                    <span className="px-4 font-bold text-base min-w-[2.5rem] text-center">
                      {productQty}
                    </span>
                    <button 
                      onClick={() => setProductQty(productQty + 1)} 
                      className="px-3.5 h-full hover:bg-neutral-100 transition text-lg"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      addToCart(selectedProduct, productQty);
                      setSelectedProduct(null);
                      setIsCartDrawerOpen(true);
                    }}
                    className="flex-1 halcyon-btn-primary h-12 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <span>إضافة إلى السلة وإتمام الطلب</span>
                    <span className="font-mono-code text-xs">({formatIQD(selectedProduct.price * productQty)})</span>
                  </button>
                </div>
              </div>

              {/* ========================================================== */}
              {/* EXACT SPECIFICATIONS TABLE (As in Pic 3 & Pic 4)           */}
              {/* ========================================================== */}
              <div className="mt-8 border-t border-neutral-300 pt-6">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                  <span className="font-extrabold text-sm sm:text-base text-black font-mono-code uppercase">
                    Specifications
                  </span>
                  <span className="font-mono-code text-xs sm:text-sm font-bold text-black">
                    {selectedProduct.part_number || "ASAS"}
                  </span>
                </div>

                <table className="w-full text-right text-xs sm:text-sm border-collapse">
                  <tbody>
                    {selectedProduct.spec_table && selectedProduct.spec_table.length > 0 ? (
                      selectedProduct.spec_table.map((row, idx) => (
                        <tr key={idx} className="border-b border-neutral-200 hover:bg-neutral-50 transition">
                          <td className="py-2.5 text-neutral-500 font-sans w-2/5 sm:w-1/3 align-top">
                            {row.label}
                          </td>
                          <td className="py-2.5 font-bold text-black font-mono-code leading-relaxed">
                            {row.value}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr className="border-b border-neutral-200">
                          <td className="py-2.5 text-neutral-500 font-sans w-2/5">الماركة / الوكالة</td>
                          <td className="py-2.5 font-bold text-black font-mono-code">أساس ASAS Turkey (أصلي 100%)</td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <td className="py-2.5 text-neutral-500 font-sans">كود القطعة (Part Number)</td>
                          <td className="py-2.5 font-bold text-black font-mono-code">{selectedProduct.part_number || selectedProduct.title}</td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <td className="py-2.5 text-neutral-500 font-sans">النوع</td>
                          <td className="py-2.5 font-bold text-black font-mono-code">{selectedProduct.clean_type || selectedProduct.type}</td>
                        </tr>
                        <tr className="border-b border-neutral-200">
                          <td className="py-2.5 text-neutral-500 font-sans">المعاينة والدفع</td>
                          <td className="py-2.5 font-bold text-black font-mono-code">فحص الطرد قبل الدفع نقداً عند الاستلام</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Direct WhatsApp Assistance */}
              <div className="pt-2">
                <a 
                  href={`https://wa.me/9647901526221?text=${encodeURIComponent(`مرحباً محل العاني، أود الاستفسار عن فلتر كود ${selectedProduct.part_number || selectedProduct.title}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center py-2.5 border border-neutral-300 text-xs font-mono-code font-bold text-neutral-700 hover:bg-neutral-50 transition"
                >
                  استفسار فني مباشر عبر واتساب لهذا الفلتر ↗
                </a>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 10. HALCYON SLIDE-OVER CART DRAWER                         */}
      {/* ========================================================== */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            onClick={() => setIsCartDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" 
          />

          <div className="absolute inset-y-0 left-0 max-w-md w-full bg-white shadow-2xl flex flex-col text-right">
            
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <button 
                onClick={() => setIsCartDrawerOpen(false)}
                className="text-xs font-mono-code text-neutral-400 hover:text-black"
              >
                [إغلاق ✕]
              </button>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-black">سلة المشتريات</span>
                <span className="font-mono-code text-xs bg-black text-white px-2 py-0.5">
                  {cartCount}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-3 text-neutral-400">
                  <svg className="w-12 h-12 mx-auto text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-sm font-semibold">سلة المشتريات فارغة</p>
                  <button 
                    onClick={() => setIsCartDrawerOpen(false)}
                    className="halcyon-btn-outline px-5 py-2 text-xs font-bold"
                  >
                    تصفح الفلاتر
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-center gap-3">
                      <div className="w-16 h-16 bg-neutral-50 border border-neutral-200 p-1 shrink-0 flex items-center justify-center">
                        <Image
                          src={item.product.image_url || "/products/oil-filter.svg"}
                          alt={item.product.title}
                          width={60}
                          height={60}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-black truncate">{item.product.title}</h4>
                        <span className="font-mono-code text-xs text-neutral-500 block">
                          {formatIQD(item.product.price)}
                        </span>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center border border-neutral-200 font-mono-code text-xs">
                            <button onClick={() => updateQuantity(item.product.id, -1)} className="px-2 py-0.5 hover:bg-neutral-100">−</button>
                            <span className="px-2 font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, 1)} className="px-2 py-0.5 hover:bg-neutral-100">+</button>
                          </div>
                          <span className="font-mono-code font-bold text-xs text-black">
                            {formatIQD(item.product.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Form */}
            {cart.length > 0 && (
              <form onSubmit={handlePlaceOrder} className="border-t border-neutral-200 p-6 bg-neutral-50 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between font-mono-code text-xs">
                    <span className="text-neutral-500">المجموع الفرعي:</span>
                    <span className="font-bold text-black">{formatIQD(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between font-mono-code text-xs">
                    <span className="text-neutral-500">أجور التوصيل:</span>
                    <span className="font-bold text-black">{formatIQD(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between font-mono-code text-sm font-bold border-t border-neutral-200 pt-2">
                    <span>المبلغ الكلي نقداً:</span>
                    <span className="text-black">{formatIQD(orderTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white focus:outline-none focus:border-black rounded-none"
                  />
                  <input
                    type="tel"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="رقم الهاتف (07xxxxxxxxx)"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 bg-white focus:outline-none focus:border-black rounded-none font-mono-code"
                  />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={custGov}
                      onChange={handleGovChange}
                      className="px-2 py-2 text-xs border border-neutral-300 bg-white focus:outline-none focus:border-black rounded-none"
                    >
                      <option value="بغداد" data-fee="5000">بغداد (5,000 د.ع)</option>
                      <option value="البصرة" data-fee="7000">البصرة (7,000 د.ع)</option>
                      <option value="أربيل" data-fee="7000">أربيل (7,000 د.ع)</option>
                      <option value="السليمانية" data-fee="7000">السليمانية (7,000 د.ع)</option>
                      <option value="نينوى" data-fee="7000">نينوى (7,000 د.ع)</option>
                      <option value="كركوك" data-fee="7000">كركوك (7,000 د.ع)</option>
                      <option value="النجف" data-fee="7000">النجف (7,000 د.ع)</option>
                      <option value="كربلاء" data-fee="7000">كربلاء (7,000 د.ع)</option>
                      <option value="بابل" data-fee="7000">بابل (7,000 د.ع)</option>
                      <option value="واسط" data-fee="7000">واسط (7,000 د.ع)</option>
                      <option value="ميسان" data-fee="7000">ميسان (7,000 د.ع)</option>
                      <option value="ذي قار" data-fee="7000">ذي قار (7,000 د.ع)</option>
                      <option value="القادسية" data-fee="7000">القادسية (7,000 د.ع)</option>
                      <option value="المثنى" data-fee="7000">المثنى (7,000 د.ع)</option>
                      <option value="ديالى" data-fee="7000">ديالى (7,000 د.ع)</option>
                      <option value="صلاح الدين" data-fee="7000">صلاح الدين (7,000 د.ع)</option>
                      <option value="الأنبار" data-fee="7000">الأنبار (7,000 د.ع)</option>
                      <option value="دهوك" data-fee="7000">دهوك (7,000 د.ع)</option>
                    </select>

                    <input
                      type="text"
                      required
                      value={custArea}
                      onChange={(e) => setCustArea(e.target.value)}
                      placeholder="المنطقة والشارع"
                      className="px-3 py-2 text-xs border border-neutral-300 bg-white focus:outline-none focus:border-black rounded-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full halcyon-btn-primary py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "جاري الحفظ..." : "تأكيد الطلب نقداً عند الاستلام"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Order Confirmed Modal */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className="text-lg font-bold text-black">تم تسجيل طلبك بنجاح!</h3>
            <p className="font-mono-code text-xs text-neutral-600">رقم الطلب: {orderConfirmed.id}</p>
            <p className="text-xs text-neutral-600">
              سيتم توصيل طلبك إلى <span className="font-bold text-black">{orderConfirmed.gov}</span> بمبلغ إجمالي{" "}
              <span className="font-bold text-black">{formatIQD(orderConfirmed.total)}</span> تدفع نقداً عند المعاينة والاستلام.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <a 
                href={orderConfirmed.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-none transition"
              >
                تأكيد فوري عبر واتساب المحل
              </a>
              <button 
                onClick={() => setOrderConfirmed(null)}
                className="w-full halcyon-btn-outline py-2.5 text-xs font-bold"
              >
                إغلاق والعودة للمتجر
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
