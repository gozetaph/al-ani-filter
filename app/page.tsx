"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product, FAQItem } from "@/lib/types";
import { initialProducts, initialFaqs } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

export default function HalcyonStorefrontPage() {
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashRevealed, setSplashRevealed] = useState(false);
  const [splashFading, setSplashFading] = useState(false);

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

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Dynamic FAQs from Admin / Supabase
  const [faqs, setFaqs] = useState<FAQItem[]>(initialFaqs);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const supabase = createClient();

  // Load Products (Supabase + Local fallback)
  useEffect(() => {
    async function loadProducts() {
      // 1. Check custom items from admin
      const localCustom = localStorage.getItem("al_ani_custom_items");
      if (localCustom) {
        try {
          const parsed = JSON.parse(localCustom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        } catch {
          // ignore
        }
      }

      // 2. Query Supabase
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const enriched = data.map((d) => {
            const mock = initialProducts.find((m) => m.slug === d.slug || m.id === d.id);
            return {
              ...d,
              other_brands: d.specs?.other_brands || d.other_brands || mock?.other_brands,
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

  // Load Dynamic FAQs (Supabase + LocalStorage fallback)
  useEffect(() => {
    async function loadFaqs() {
      // 1. LocalStorage
      const cached = localStorage.getItem("al_ani_faqs");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFaqs(parsed);
          }
        } catch {
          // ignore
        }
      }

      // 2. Supabase
      try {
        const { data, error } = await supabase
          .from("faqs")
          .select("*")
          .eq("is_active", true)
          .order("order_index", { ascending: true });

        if (!error && data && data.length > 0) {
          setFaqs(data);
        }
      } catch {
        // Fallback to initialFaqs
      }
    }
    loadFaqs();
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

  // Helper to extract or format cross-reference brands for a product
  const getProductBrands = (product: Product) => {
    if (product.other_brands && product.other_brands.length > 0) {
      return product.other_brands;
    }

    // Auto-extract from OEM Cross Ref row if present in spec_table
    const crossRow = product.spec_table?.find((r) =>
      r.label.includes("المطابقة") || r.label.includes("OEM")
    );
    if (crossRow && crossRow.value) {
      const parts = crossRow.value.split(/[,،]/);
      const parsed: { brand: string; code: string }[] = [];
      
      parts.forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) {
          const spaceIdx = trimmed.indexOf(" ");
          if (spaceIdx > 0) {
            parsed.push({
              brand: trimmed.substring(0, spaceIdx).trim(),
              code: trimmed.substring(spaceIdx + 1).trim(),
            });
          } else {
            parsed.push({ brand: "OEM", code: trimmed });
          }
        }
      });

      if (parsed.length > 0) return parsed;
    }

    // Default fallback brand representation
    const pNum = product.part_number || product.title.split(" ").pop() || "";
    return [
      { brand: "AL ANI", code: pNum },
      { brand: "مطابقة فنية", code: "متوفر حسب الطلب" },
    ];
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#111111] flex flex-col antialiased selection:bg-[#111111] selection:text-white">
      
      {/* ========================================================== */}
      {/* APPLE SPLASH SCREEN ANIMATION (A SLIDES -> TEXT)           */}
      {/* ========================================================== */}
      {showSplash && (
        <div 
          className={`fixed inset-0 z-[100] bg-[#004bb5] flex items-center justify-center p-6 transition-all duration-700 ease-in-out ${
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

            {/* Arabic Calligraphy "العاني للفلاتر" */}
            <div 
              className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center shrink-0 ${
                splashRevealed ? "max-w-[500px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              <Image 
                src="/logo_text_trans.png" 
                alt="العاني للفلاتر" 
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
      {/* 2. MAIN NAVBAR (Height: 48px desktop / 44px mobile)        */}
      {/* ========================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-8 h-12 flex items-center justify-between transition-all">
        
        {/* Left: Brand Identity (العاني للفلاتر) */}
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
                العاني للفلاتر
              </span>
              <span className="text-[9px] font-mono-code text-neutral-500 uppercase tracking-wider">
                AL ANI FILTERS • CATALOG
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-semibold tracking-normal text-neutral-700">
          <a href="#catalog" className="hover:text-black transition">كتالوج الفلاتر</a>
          <a href="#oem-lookup" className="hover:text-black transition">الماركات وأرقام OEM</a>
          <a href="#faq" className="hover:text-black transition">الأسئلة الشائعة</a>
        </nav>

        {/* Right: Actions (Direct WhatsApp CTA instead of Cart) */}
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

          <a 
            href="https://wa.me/9647901526221?text=مرحباً العاني للفلاتر، أود الاستفسار عن توفر فلتر"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 sm:px-4 py-1.5 rounded-none text-xs font-semibold hover:bg-emerald-700 transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.698.077-1.116-.062-.26-.086-.594-.216-1.026-.406-1.808-.795-2.984-2.617-3.076-2.739-.088-.121-.734-.977-.734-1.86 0-.884.464-1.32.63-1.498.167-.179.365-.224.487-.224.122 0 .243.001.35.006.112.006.262-.043.41.312.152.365.518 1.265.564 1.357.045.091.076.197.015.318-.061.121-.091.197-.182.303-.091.107-.193.238-.276.321-.091.091-.186.19-.08.373.107.182.474.782 1.018 1.267.701.624 1.292.818 1.474.909.182.091.289.076.395-.046.107-.121.456-.532.578-.715.121-.182.243-.152.41-.091.167.061 1.062.502 1.244.593.182.091.304.137.35.213.045.076.045.441-.099.846z"/>
            </svg>
            <span>استفسار واتساب</span>
          </a>
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
              <span className="font-mono-code text-xs text-neutral-400">{products.length} قطعة</span>
            </a>
            <a 
              href="#oem-lookup" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100"
            >
              مطابقة أرقام OEM والماركات
            </a>
            <a 
              href="#faq" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100"
            >
              الأسئلة الشائعة
            </a>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <a 
              href="https://wa.me/9647901526221?text=مرحباً العاني للفلاتر، أود الاستفسار عن توفر فلتر" 
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
      {/* 3. HERO SECTION (العاني للفلاتر)                           */}
      {/* ========================================================== */}
      <section className="relative w-full h-[85vh] md:h-screen overflow-hidden bg-neutral-950 flex flex-col justify-between">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero_engine_poster.jpg"
            className="w-full h-full object-cover scale-105 transform motion-safe:animate-subtleZoom opacity-75"
          >
            <source src="/hero_engine.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/60" />
        </div>

        {/* Hero Top Title */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 w-full text-right">
          <h1 className="text-white text-5xl sm:text-7xl lg:text-9xl font-black tracking-tight leading-[0.98]">
            العاني للفلاتر
            <span className="block text-xl sm:text-3xl lg:text-4xl font-sans font-bold text-neutral-300 mt-4 tracking-normal">
              فلاتر أصلية. أداء يدوم لأقسى الظروف.
            </span>
          </h1>
        </div>

        {/* Hero Bottom: Multi-brand Caption */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-12 sm:pb-16 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl text-right">
            <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
              في العاني للفلاتر نوفر منظومة ترشيح أصلية متكاملة للسيارات والشاحنات والمولدات والمعدات الثقيلة لأشهر الماركات العالمية (Mann, Perkins, Fleetguard, Donaldson, ASAS, MAK) مع مطابقة هندسية دقيقة لمواصفات المصنع OEM واستشارات فنية مباشرة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a 
              href="#catalog" 
              className="px-6 py-3 bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 transition"
            >
              <span>استعراض كتالوج الفلاتر</span>
              <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            
            <a 
              href="#oem-lookup" 
              className="px-6 py-3 border border-white text-white hover:bg-white hover:text-black text-xs sm:text-sm font-mono-code font-bold uppercase tracking-wider transition"
            >
              مطابقة كود القطعة OEM
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* 4. CATALOG SEARCH & COLLECTION                             */}
      {/* ========================================================== */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-8 py-12 w-full flex-1">
        
        {/* Controls Bar */}
        <div className="bg-white border border-neutral-200 p-4 sm:p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
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
              placeholder="ابحث برقم القطعة (مثل SP 1450 أو CF 233) أو نوع المحرك..."
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

          {/* Dropdown Filter Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full md:w-auto px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-xs font-mono-code font-bold text-black flex items-center justify-between gap-4 transition min-w-[200px]"
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>{activeCategory === "الكل" ? "تصفية الفئات (الكل)" : activeCategory}</span>
              </div>
              <svg className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCategoryDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsCategoryDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-neutral-300 shadow-xl z-30 py-1 text-right divide-y divide-neutral-100 animate-fadeIn">
                  {categories.map((cat) => {
                    const count = products.filter((p) =>
                      cat === "الكل" ? true : (p.type || p.category || "").includes(cat.replace("فلاتر ", ""))
                    ).length;
                    const isSelected = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setIsCategoryDropdownOpen(false);
                          triggerHaptic("light");
                        }}
                        className={`w-full px-4 py-2.5 text-xs flex items-center justify-between font-mono-code transition text-right ${
                          isSelected ? "bg-black text-white font-bold" : "text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span className={`text-[10px] px-1.5 py-0.5 ${isSelected ? "bg-white text-black font-bold" : "bg-neutral-100 text-neutral-500"}`}>
                          {count}
                        </span>
                        <span className="font-sans">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active Filter Pill Badge */}
        {activeCategory !== "الكل" && (
          <div className="mb-6 flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-mono-code">تصفية نشطة:</span>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-xs font-mono-code font-bold">
              <span>{activeCategory}</span>
              <button
                onClick={() => {
                  setActiveCategory("الكل");
                  triggerHaptic("light");
                }}
                className="hover:text-neutral-300 font-bold"
                title="إلغاء التصفية"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {/* 5. PRODUCT GRID (No Prices, Showcase Only) */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-neutral-200 p-12 text-center space-y-4">
            <svg className="w-12 h-12 mx-auto text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-base font-bold text-neutral-800">لا توجد فلاتر مطابقة لبحثك</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              جرب البحث برقم آخر، أو تواصل معنا مباشرة عبر واتساب وسيقوم الفني بالتحقق من رقم القطعة المطلوب وتوفيره لك فوراً.
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
              const partNumber = product.part_number || product.title.split(" ").pop() || "AL-ANI";
              const cleanType = product.clean_type || product.type?.replace(/^فلاتر\s+/, "فلتر ") || "فلتر أصلي";
              
              return (
                <div 
                  key={product.id}
                  className="bg-white border border-neutral-200 group flex flex-col justify-between hover:border-black transition-all duration-300 relative"
                >
                  {/* Top Image Container */}
                  <div 
                    onClick={() => setSelectedProduct(product)}
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
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3 text-right">
                    <div className="space-y-1">
                      <span className="text-[10px] sm:text-[11px] font-mono-code text-neutral-500 uppercase block">
                        {cleanType}
                      </span>
                      
                      {/* Bold Part Number */}
                      <h3 
                        onClick={() => setSelectedProduct(product)}
                        className="font-black text-sm sm:text-base text-[#111111] font-mono-code cursor-pointer hover:underline tracking-tight"
                      >
                        {partNumber}
                      </h3>

                      <p className="text-[11px] text-neutral-600 line-clamp-1">
                        {product.title}
                      </p>
                    </div>

                    {/* View Details / Inquire Button (No Price) */}
                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <span className="font-mono-code text-[11px] text-neutral-400">
                        كود: {partNumber}
                      </span>

                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="bg-black text-white hover:bg-neutral-800 text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-none transition active:scale-95 shrink-0"
                      >
                        الماركات ↗
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
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-black">
            مطابقة جميع أرقام القطع الأصلية OEM
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            نوفر بدائل هندسية وماركات عالمية مطابقة تماماً لمواصفات شركات الفلاتر العالمية. أرسل لنا رقم القطعة المسجل على الفلتر القديم وسنوفر لك الفلتر المطابق فوراً.
          </p>

          <div className="pt-4">
            <a 
              href="https://wa.me/9647901526221?text=مرحباً العاني للفلاتر، أود الاستفسار عن مطابقة فلتر لرقم القطعة OEM التالي: " 
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
      {/* 7. DYNAMIC FAQ SECTION (Managed from /admin/faq)          */}
      {/* ========================================================== */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-8 py-16 w-full">
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-black">الأسئلة الشائعة</h2>
          <p className="text-xs text-neutral-500">إجابات استفسارات المطابقة والماركات</p>
        </div>

        <div className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
          {faqs.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.id || idx} className="py-4 px-4 sm:px-6">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-right text-sm sm:text-base font-bold text-neutral-900 gap-4 cursor-pointer"
                >
                  <span>{item.question}</span>
                  <span className="font-mono-code text-lg text-neutral-400 shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-neutral-600 leading-relaxed text-right pl-4">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================== */}
      {/* 8. ARCHITECTURAL FOOTER (العاني للفلاتر)                   */}
      {/* ========================================================== */}
      <footer className="bg-white border-t border-neutral-200 mt-auto text-neutral-700 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-right">
            
            {/* Col 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image src="/logo_a_blue_trans.png" alt="العاني" width={30} height={30} className="h-7 w-auto object-contain" />
                <span className="font-black text-sm text-black">العاني للفلاتر</span>
              </div>
              <p className="text-neutral-500 leading-relaxed text-xs">
                بغداد، العراق • متخصصون في فلاتر المحركات الأصلية، الشاحنات، والمولدات، والمعدات الثقيلة لكافة الماركات العالمية.
              </p>
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
                الاتصال والاستفسار
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
                الماركات والاستشارات
              </span>
              <p className="text-neutral-500 text-xs leading-relaxed">
                نوفر بدائل هندسية متطابقة مع كافة الماركات العالمية (Mann+Hummel, Perkins, Fleetguard, Donaldson, MAK, ASAS, Baldwin). تواصل معنا بالرقم القديم لنزودك بالبديل المعتمد.
              </p>
            </div>

          </div>

          <div className="border-t border-neutral-200 mt-12 pt-6 font-mono-code text-[11px] text-neutral-400 text-center">
            AL ANI FILTERS • BAGHDAD, IRAQ
          </div>
        </div>
      </footer>

      {/* ========================================================== */}
      {/* 9. PRODUCT DETAIL MODAL (Dismiss by clicking outside)      */}
      {/* ========================================================== */}
      {selectedProduct && (
        <div 
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4 sm:p-6 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-0 sm:border border-neutral-300 max-w-2xl w-full max-h-[92vh] overflow-y-auto text-right p-5 sm:p-8 relative space-y-6 shadow-2xl cursor-default"
          >
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

              {/* Product Code Header */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <h1 className="text-3xl sm:text-5xl font-black font-mono-code text-black tracking-tight">
                  {selectedProduct.part_number || selectedProduct.title.split(" ").pop()}
                </h1>

                <p className="text-sm sm:text-base font-semibold text-neutral-700 leading-snug">
                  {selectedProduct.subtitle || selectedProduct.title}
                </p>
              </div>

              {/* DIRECT WHATSAPP ACTION BUTTON (Replaces Price and Add to Cart) */}
              <div className="pt-2 border-t border-neutral-200">
                <a 
                  href={`https://wa.me/9647901526221?text=${encodeURIComponent(`مرحباً العاني للفلاتر، أود الاستفسار عن توفر فلتر كود ${selectedProduct.part_number || selectedProduct.title.split(" ").pop()}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full halcyon-btn-primary h-12 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>استفسار مباشر عبر واتساب لهذا الفلتر</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.698.077-1.116-.062-.26-.086-.594-.216-1.026-.406-1.808-.795-2.984-2.617-3.076-2.739-.088-.121-.734-.977-.734-1.86 0-.884.464-1.32.63-1.498.167-.179.365-.224.487-.224.122 0 .243.001.35.006.112.006.262-.043.41.312.152.365.518 1.265.564 1.357.045.091.076.197.015.318-.061.121-.091.197-.182.303-.091.107-.193.238-.276.321-.091.091-.186.19-.08.373.107.182.474.782 1.018 1.267.701.624 1.292.818 1.474.909.182.091.289.076.395-.046.107-.121.456-.532.578-.715.121-.182.243-.152.41-.091.167.061 1.062.502 1.244.593.182.091.304.137.35.213.045.076.045.441-.099.846z"/>
                  </svg>
                </a>
              </div>

              {/* ========================================================== */}
              {/* "الماركات الأخرى" (Replaces SPECIFICATIONS table)          */}
              {/* ========================================================== */}
              <div className="mt-8 border-t border-neutral-300 pt-6">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                  <span className="font-extrabold text-sm sm:text-base text-black font-mono-code uppercase">
                    الماركات الأخرى
                  </span>
                  <span className="font-mono-code text-xs sm:text-sm font-bold text-neutral-500">
                    أرقام المطابقة البديلة
                  </span>
                </div>

                {/* Vertical list of brands one below the other */}
                <div className="divide-y divide-neutral-200">
                  {getProductBrands(selectedProduct).map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                        <span className="font-bold text-neutral-900">{item.brand}</span>
                      </div>
                      <span className="font-mono-code font-bold text-neutral-900 tracking-wider">
                        {item.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
