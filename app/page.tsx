"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { initialProducts } from "@/lib/mock-data";
import { Product } from "@/lib/types";

// Iraqi Governorates with COD delivery fees
const GOVERNORATES = [
  { name: "بغداد", fee: 5000 },
  { name: "البصرة", fee: 7000 },
  { name: "أربيل", fee: 7000 },
  { name: "النجف الأشرف", fee: 7000 },
  { name: "كربلاء المقدسة", fee: 7000 },
  { name: "نينوى (الموصل)", fee: 7000 },
  { name: "كركوك", fee: 7000 },
  { name: "السليمانية", fee: 7000 },
  { name: "بابل (الحلة)", fee: 7000 },
  { name: "الأنبار (الرمادي/الفلوجة)", fee: 7000 },
  { name: "ديالى (بعقوبة)", fee: 7000 },
  { name: "ذي قار (الناصرية)", fee: 7000 },
  { name: "صلاح الدين (تكريت/سامراء)", fee: 7000 },
  { name: "القادسية (الديوانية)", fee: 7000 },
  { name: "واسط (الكوت)", fee: 7000 },
  { name: "ميسان (العمارة)", fee: 7000 },
  { name: "المثنى (السماوة)", fee: 7000 },
  { name: "دهوك", fee: 7000 },
];

export default function HalcyonStorefrontPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [orderConfirmed, setOrderConfirmed] = useState<{ id: string; total: number; gov: string; waUrl: string } | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live Baghdad Clock
  const [baghdadTime, setBaghdadTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Baghdad",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      };
      setBaghdadTime(new Intl.DateTimeFormat("en-US", options).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Header scroll detection for Halcyon transparent-to-solid navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Supabase Client
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vfxgkajqrhgorvzwhecg.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy"
    )
  );

  useEffect(() => {
    async function loadProducts() {
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

  // Checkout Form State
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custGov, setCustGov] = useState("بغداد");
  const [custAddress, setCustAddress] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const itemsSummary = cart.map((i) =>
      `• ${i.product.title} [كود: ${i.product.part_number || i.product.title}] (العدد: ${i.quantity}) - ${formatIQD(i.product.price * i.quantity)}`
    ).join("\n");

    const waText =
      `*طلب جديد من متجر محل العاني للفلتر (وكالة أساس ASAS)*\n` +
      `-------------------------------------------\n` +
      `*رقم الطلب:* ${orderId}\n` +
      `*الاسم:* ${custName}\n` +
      `*رقم الهاتف:* ${custPhone}\n` +
      `*المحافظة:* ${custGov}\n` +
      `*العنوان:* ${custAddress}\n` +
      (custNotes ? `*ملاحظات الزبون:* ${custNotes}\n` : "") +
      `-------------------------------------------\n` +
      `*القطع المطلوبة:*\n${itemsSummary}\n` +
      `-------------------------------------------\n` +
      `*المجموع الفرعي:* ${formatIQD(cartSubtotal)}\n` +
      `*أجور التوصيل:* ${formatIQD(deliveryFee)} (${custGov})\n` +
      `*المجموع الإجمالي عند الاستلام:* ${formatIQD(orderTotal)}\n` +
      `*سياسة الدفع:* نقداً عند الاستلام مع فحص الطرد قبل الدفع.`;

    const waUrl = `https://wa.me/9647901526221?text=${encodeURIComponent(waText)}`;

    try {
      await supabase.from("orders").insert([
        {
          order_id: orderId,
          customer_name: custName,
          customer_phone: custPhone,
          governorate: custGov,
          address: custAddress,
          items: cart,
          total_price: orderTotal,
          delivery_fee: deliveryFee,
          status: "pending",
        },
      ]);
    } catch {
      // offline mode fallback
    }

    setOrderConfirmed({
      id: orderId,
      total: orderTotal,
      gov: custGov,
      waUrl,
    });

    setCart([]);
    setIsSubmitting(false);
  };

  const formatIQD = (num: number) => {
    return num.toLocaleString("en-US") + " د.ع";
  };

  const triggerHaptic = (type: "light" | "medium") => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(type === "light" ? 15 : 30);
    }
  };

  const scrollToCatalogAndFocus = () => {
    const el = document.getElementById("catalog");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#111111] flex flex-col antialiased selection:bg-[#111111] selection:text-white">
      
      {/* ========================================================== */}
      {/* 1. HALCYON TOP ANNOUNCEMENT BAR (Height ~37px)             */}
      {/* ========================================================== */}
      <div className="bg-[#111111] text-white text-[11px] sm:text-xs font-mono-code px-4 sm:px-8 py-2 flex items-center justify-between border-b border-neutral-800 z-50 relative">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>بغداد {baghdadTime || "06:00 AM"} • مفتوح للطلبات</span>
          <span className="hidden md:inline text-neutral-400">| شحن لكافة المحافظات 18 والدفع عند الاستلام</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-300">
          <a href="tel:+9647901526221" className="hover:text-white transition">0790 152 6221</a>
          <span className="hidden sm:inline text-neutral-600">/</span>
          <a href="tel:+9647710077880" className="hidden sm:inline hover:text-white transition">0771 007 7880</a>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. HALCYON DUAL-STATE NAVBAR (Transparent on Hero -> Solid) */}
      {/* ========================================================== */}
      <header
        className={`sticky top-0 z-40 px-4 sm:px-8 h-12 flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-neutral-200 text-[#111111] shadow-sm"
            : "bg-black/25 backdrop-blur-sm border-b border-white/10 text-white"
        }`}
      >
        {/* Left: Brand Identity with White/Blue Logo swap */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-1.5 focus:outline-none transition ${isScrolled ? "text-neutral-800 hover:text-black" : "text-white hover:text-neutral-200"}`}
            aria-label="القائمة"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2.5 group">
            <Image 
              src={isScrolled ? "/logo_a_blue_trans.png" : "/logo_a_trans.png"}
              alt="العاني" 
              width={28} 
              height={28} 
              className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105" 
            />
            <div className="flex flex-col">
              <span className={`font-extrabold text-sm sm:text-base tracking-tight leading-none ${isScrolled ? "text-[#111111]" : "text-white"}`}>
                محل العاني للفلتر
              </span>
              <span className={`text-[9px] font-mono-code uppercase tracking-wider ${isScrolled ? "text-neutral-500" : "text-neutral-300"}`}>
                ASAS FILTER AGENCY
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className={`hidden md:flex items-center gap-6 lg:gap-8 text-xs font-semibold tracking-normal ${isScrolled ? "text-neutral-700" : "text-neutral-200"}`}>
          <a href="#hero" className="hover:text-black dark:hover:text-white transition">الرئيسية</a>
          <a href="#engineering" className="hover:text-black dark:hover:text-white transition">الهندسة والجودة</a>
          <a href="#catalog" className="hover:text-black dark:hover:text-white transition">كتالوج الفلاتر (80)</a>
          <a href="#oem-lookup" className="hover:text-black dark:hover:text-white transition">مطابقة OEM</a>
          <a href="#faq" className="hover:text-black dark:hover:text-white transition">الشحن والضمان</a>
          <Link href="/admin" className="font-mono-code text-[11px] opacity-75 hover:opacity-100 transition">
            [لوحة الإدارة]
          </Link>
        </nav>

        {/* Right: Actions (Search Trigger & Monospace Cart Counter) */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={scrollToCatalogAndFocus}
            className={`p-2 transition ${isScrolled ? "text-neutral-700 hover:text-black" : "text-neutral-200 hover:text-white"}`}
            title="بحث في الكتالوج"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              setIsCartDrawerOpen(true);
            }}
            className={`px-3 py-1.5 text-xs font-mono-code font-bold flex items-center gap-2 border transition ${
              isScrolled
                ? "bg-[#111111] text-white border-[#111111] hover:bg-black"
                : "bg-white/10 text-white border-white/30 backdrop-blur-md hover:bg-white hover:text-black hover:border-white"
            }`}
          >
            <span>السلة</span>
            <span className={`px-1.5 py-0.2 text-[10px] ${isScrolled ? "bg-white text-black" : "bg-white text-black font-extrabold"}`}>
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
              href="#engineering" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 border-b border-neutral-100"
            >
              الهندسة وتكنولوجيا الترشيح
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
              className="w-full text-center py-2.5 bg-emerald-600 text-white text-xs font-bold"
            >
              تواصل عبر واتساب المباشر
            </a>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 3. HALCYON SECTION 1: FULL-BLEED 100vh / 90vh HERO         */}
      {/* ========================================================== */}
      <section id="hero" className="relative w-full h-[90vh] md:h-[calc(100vh-37px)] overflow-hidden bg-neutral-950 flex flex-col justify-between">
        {/* Background Looping Video with Poster Fallback */}
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
          {/* Halcyon Dark Cinematic Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/60" />
        </div>

        {/* Hero Content Overlay: Top Headline */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-10 sm:pt-16 w-full text-right">
          <div className="inline-flex items-center gap-2 border border-white/20 px-3 py-1 bg-white/5 backdrop-blur-md text-[10px] sm:text-xs font-mono-code text-neutral-300 mb-4 sm:mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ASAS GENUINE AUTOMOTIVE & INDUSTRIAL FILTRATION • BAGHDAD SINAK</span>
          </div>

          <h1 className="text-white text-5xl sm:text-7xl lg:text-9xl font-extrabold tracking-tight leading-[0.95] uppercase font-mono-code">
            GOOD
            <span className="block text-white/90">FILTRATION.</span>
            <span className="block text-xl sm:text-3xl lg:text-4xl font-sans font-bold text-neutral-400 normal-case mt-3 tracking-normal">
              فلاتر أصلية. أداء يدوم لأقسى الظروف.
            </span>
          </h1>
        </div>

        {/* Hero Content Overlay: Bottom Heritage Caption & Ghost Action Buttons */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-10 sm:pb-16 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl text-right">
            <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
              في محل العاني للفلتر، نوفر فلاتر أساس التركية الأصلية المصنعة وفق أعلى المعايير الهندسية لمواصفات المصنع OEM. من قلب سوق السنك في بغداد، نضمن وصول الفلاتر المعتمدة لكافة محافظات العراق الـ 18 مع فحص الطرد قبل الدفع نقداً.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#catalog"
              className="px-6 py-3 border border-white text-white text-xs font-mono-code font-bold uppercase tracking-wider hover:bg-white hover:text-black transition"
            >
              استعراض الكتالوج (80 فلتر) ↓
            </a>
            <a
              href="#engineering"
              className="px-6 py-3 border border-white/30 bg-white/10 backdrop-blur-md text-white text-xs font-mono-code font-bold uppercase tracking-wider hover:bg-white/20 transition"
            >
              الهندسة الأصلية ↗
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* 4. HALCYON SECTION 2: MODULAR SHOWCASE & 3D EXPLODED VIEW  */}
      {/* ========================================================== */}
      <section id="engineering" className="bg-[#ffffff] border-b border-neutral-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          {/* Header Split Layout */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 sm:mb-16 pb-8 border-b border-neutral-200">
            <div className="space-y-3 text-right max-w-2xl">
              <span className="font-mono-code text-xs text-neutral-500 font-bold tracking-widest uppercase">
                ENGINEERING & INTERNAL QUALITY • ASAS TURKEY
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#111111] tracking-tight">
                سلسلة الآليات الثقيلة والمولدات
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-sans">
                صُممت فلاتر أساس التركية بأحدث تكنولوجيا الترشيح الميكرو-اصطناعي المقاوم لدرجات حرارة الصيف الشديدة في العراق (أكثر من 50°C) وغبار الطرق الصحراوية. هيكل فولاذي مانع للانهيار وصمامات سيليكون حرارية تمنع جفاف مجاري الزيت عند الإقلاع الصباحي.
              </p>
            </div>
            <div>
              <a
                href="#catalog"
                onClick={() => setActiveCategory("فلاتر مجفف هواء للشاحنات")}
                className="inline-flex items-center gap-2 text-xs font-mono-code font-bold text-black border-b border-black pb-1 hover:text-blue-600 hover:border-blue-600 transition"
              >
                <span>مشاهدة فلاتر الشاحنات والآليات</span>
                <span>↗</span>
              </a>
            </div>
          </div>

          {/* 3D Exploded Technical Layout & Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
            
            {/* 3D Exploded Graphic */}
            <div className="lg:col-span-7 bg-neutral-900 rounded-none overflow-hidden relative border border-neutral-800 p-2 sm:p-4 group">
              <div className="relative aspect-video w-full overflow-hidden">
                <Image
                  src="/hero_filter_exploded.jpg"
                  alt="3D Exploded View ASAS Oil Filter"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                />
              </div>
              <div className="p-3 bg-neutral-950 flex items-center justify-between text-[11px] font-mono-code text-neutral-400">
                <span>ASAS 3D EXPLODED ARCHITECTURE</span>
                <span className="text-emerald-400 font-bold">100% OEM CERTIFIED</span>
              </div>
            </div>

            {/* 5-Layer Engineering Points */}
            <div className="lg:col-span-5 space-y-3 text-right">
              {[
                { num: "01", title: "غلاف فولاذي معزز ضد الانفجار", desc: "يتحمل ضغوط التشغيل القصوى حتى 25 بار دون أي تشوه." },
                { num: "02", title: "صمام سيليكون حراري مانع للرجوع", desc: "يحافظ على امتلاء الفلتر بالزيت لمنع الاحتكاك الجاف عند أول تشغيل صباحي." },
                { num: "03", title: "وسيط ألياف ميكرو-اصطناعية 99.5%", desc: "طيات متلاصقة محكمة تحتجز ذرات الكربون والرواسب حتى 10 ميكرون." },
                { num: "04", title: "قلب معدني مخرم مانع للانهيار", desc: "يدعم طيات الفلتر تحت أقصى تدفق للزيت في السرعات العالية." },
                { num: "05", title: "صمام أمان تفريغ الضغط الزائد", desc: "يضمن استمرار التزييت في الحالات القصوى والبرودة العالية." },
              ].map((pt, idx) => (
                <div key={idx} className="p-3 bg-[#f8f8f8] border border-neutral-200 hover:border-black transition">
                  <div className="flex items-center gap-2 mb-1 justify-end">
                    <span className="font-bold text-xs sm:text-sm text-black">{pt.title}</span>
                    <span className="font-mono-code text-[11px] font-bold text-neutral-400">[{pt.num}]</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-normal">{pt.desc}</p>
                </div>
              ))}
            </div>

          </div>

          {/* 4 Flagship Heavy-Duty Filter Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products
              .filter((p) => ["SP 1450", "SP 1453", "AS 845", "SP 900"].includes(p.part_number || ""))
              .slice(0, 4)
              .map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    setSelectedProduct(prod);
                    setProductQty(1);
                  }}
                  className="bg-white border border-neutral-200 p-4 flex flex-col justify-between hover:border-black transition cursor-pointer group"
                >
                  <div className="aspect-square relative w-full bg-[#f8f8f8] mb-3 overflow-hidden">
                    <Image
                      src={prod.image_url}
                      alt={prod.title}
                      fill
                      className="object-contain p-4 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="font-mono-code text-xs font-bold text-black uppercase block">
                      {prod.part_number || prod.title}
                    </span>
                    <p className="text-[11px] text-neutral-500 truncate">{prod.title}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                      <span className="font-mono-code text-xs font-bold text-black">
                        {formatIQD(prod.price)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">متوفر</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>

        </div>
      </section>

      {/* ========================================================== */}
      {/* 5. HALCYON SECTION 3: TABBED COLLECTION & SEARCH GRID      */}
      {/* ========================================================== */}
      <section id="catalog" className="bg-[#f8f8f8] py-14 sm:py-20 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="text-right">
              <span className="font-mono-code text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">
                LATEST GENUINE COLLECTIONS
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
                كتالوج الفلاتر المتوفرة ({filteredProducts.length} قطعة)
              </h2>
            </div>
            
            {/* Integrated Halcyon Search Bar with Live Clear */}
            <div className="w-full md:w-96 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الفلتر (CF 233, SP 1450) أو الطراز..."
                className="w-full text-right bg-white border border-neutral-300 px-4 py-2.5 text-xs font-mono-code focus:outline-none focus:border-black transition pr-9"
              />
              <span className="absolute left-3 top-3 text-neutral-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs font-bold text-neutral-400 hover:text-black"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Halcyon Monospace Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b border-neutral-300 no-scrollbar">
            {categories.map((cat) => {
              const count = products.filter((p) =>
                cat === "الكل" ? true : (p.type || p.category || "").includes(cat.replace("فلاتر ", ""))
              ).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveCategory(cat);
                  }}
                  className={`whitespace-nowrap px-4 py-2 text-xs font-mono-code font-bold transition flex items-center gap-2 border-b-2 ${
                    isActive
                      ? "border-black text-black"
                      : "border-transparent text-neutral-500 hover:text-black hover:border-neutral-400"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1 py-0.2 ${isActive ? "bg-black text-white" : "bg-neutral-200 text-neutral-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Halcyon 4-Column Desktop / 2-Column Mobile Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white border border-neutral-200 p-8 space-y-3">
              <span className="font-mono-code text-2xl">⚠️</span>
              <p className="font-bold text-sm text-black">لم يتم العثور على فلاتر مطابقة لبحثك</p>
              <p className="text-xs text-neutral-500">جرب البحث برقم الفلتر المباشر أو تواصل مع الدعم الفني للاستفسار</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("الكل");
                }}
                className="mt-2 px-4 py-2 bg-black text-white text-xs font-mono-code font-bold"
              >
                إعادة ضبط البحث
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-neutral-200 flex flex-col justify-between hover:border-black transition-all group"
                >
                  {/* Clickable Image Container */}
                  <div
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductQty(1);
                    }}
                    className="aspect-square relative w-full bg-[#ffffff] cursor-pointer overflow-hidden p-4 flex items-center justify-center border-b border-neutral-100"
                  >
                    <Image
                      src={product.image_url}
                      alt={product.title}
                      width={300}
                      height={300}
                      className="object-contain max-h-full max-w-full group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 text-[9px] font-mono-code font-bold uppercase px-1.5 py-0.5 bg-neutral-100 text-neutral-700">
                      ASAS
                    </span>
                  </div>

                  {/* Product Metadata */}
                  <div className="p-4 space-y-2 text-right flex-1 flex flex-col justify-between">
                    <div>
                      <span className="font-mono-code text-sm font-extrabold text-black uppercase tracking-tight block">
                        {product.part_number || product.title}
                      </span>
                      <p className="text-xs text-neutral-600 line-clamp-1 font-sans mt-0.5">
                        {product.title}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-code text-xs sm:text-sm font-bold text-black">
                          {formatIQD(product.price)}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-mono-code font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>متوفر</span>
                        </div>
                      </div>

                      {/* Action Buttons: View Specs Modal + Quick Add */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setProductQty(1);
                          }}
                          className="w-full py-2 border border-neutral-300 text-neutral-700 hover:border-black hover:text-black text-[11px] font-mono-code font-bold transition text-center"
                        >
                          المواصفات
                        </button>
                        <button
                          onClick={() => addToCart(product, 1)}
                          className="w-full py-2 bg-[#111111] text-white hover:bg-black text-[11px] font-mono-code font-bold transition text-center"
                        >
                          + السلة
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ========================================================== */}
      {/* 6. HALCYON SECTION 4: INDUSTRIAL SERIES BANNER             */}
      {/* ========================================================== */}
      <section className="bg-neutral-900 text-white py-16 sm:py-20 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4 text-right">
              <span className="font-mono-code text-xs font-bold text-amber-400 tracking-widest uppercase">
                DIESEL PURIFICATION & WATER SEPARATORS
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                فلاتر فاصل الماء وسبيتر الديزل (Water Separator)
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans max-w-2xl">
                يحتوي وقود الديزل المحلي على نسب من الرطوبة والمياه المكثفة التي تسبب التآكل المباشر لنوزلات وبخاخات محركات الديزل الحديثة (Common Rail). توفر فلاتر سبيتر أساس كفاءة فصل ماء تبلغ 99.8% مع صمام تفريغ سفلي نقي، لحماية طرمبة الديزل من التلف المبكر.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setActiveCategory("فلاتر فاصل ماء وسبيتر");
                    scrollToCatalogAndFocus();
                  }}
                  className="px-6 py-2.5 bg-white text-black text-xs font-mono-code font-bold hover:bg-neutral-200 transition"
                >
                  استعراض فلاتر فاصل الماء ↗
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 p-6 space-y-4 text-right">
              <span className="font-mono-code text-xs text-neutral-400 uppercase block border-b border-neutral-800 pb-2">
                ASAS WATER SEPARATOR EFFICIENCY
              </span>
              <div className="space-y-3 font-mono-code text-xs">
                <div className="flex justify-between">
                  <span className="text-emerald-400 font-bold">99.8%</span>
                  <span className="text-neutral-400">Water Separation:</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white font-bold">10 Micron</span>
                  <span className="text-neutral-400">Particle Filtration:</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white font-bold">ISO 16332 Compliant</span>
                  <span className="text-neutral-400">Certification:</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================== */}
      {/* 7. HALCYON SECTION 5: OEM LOOKUP & RESOURCE HUB            */}
      {/* ========================================================== */}
      <section id="oem-lookup" className="bg-white py-16 sm:py-24 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="text-right max-w-2xl mb-12">
            <span className="font-mono-code text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">
              RESOURCE HUB & CROSS-REFERENCE
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
              مركز مطابقة أرقام المصنع OEM والشركات
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2 font-sans leading-relaxed">
              تطابق فلاتر أساس التركية مع كبرى الشركات المصنعة عالمياً. إذا كان لديك رقم فلتر Mann، Fleetguard، Donaldson أو رقم وكالة السيارة، يمكنك المطابقة الفورية عبر الجدول أدناه أو عبر الواتساب.
            </p>
          </div>

          <div className="border border-neutral-200 overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-neutral-200 font-mono-code text-neutral-700">
                  <th className="p-3">كود أساس ASAS</th>
                  <th className="p-3">النوع والتطبيق</th>
                  <th className="p-3">مطابقة Mann / OEM</th>
                  <th className="p-3">المركبات المتوافقة</th>
                  <th className="p-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-sans">
                {[
                  { asas: "CF 233", type: "فلتر كابينة ومكيف", oem: "Mann CU 26 003 / 97133-2H001", app: "Hyundai Elantra, Kia Cerato" },
                  { asas: "SP 1450", type: "فلتر دهن شاحنات", oem: "Mann W 11 102 / LF 3325", app: "Mercedes Actros, Scania Trucks" },
                  { asas: "SP 900", type: "فلتر ديزل رئيسي", oem: "Mann WK 940/5 / FF 5052", app: "Perkins, Caterpillar Generators" },
                  { asas: "AS 845", type: "فلتر مجفف هواء (Air Dryer)", oem: "Knorr II39797 / Wabco 432410", app: "Volvo, MAN, Scania Prime Movers" },
                  { asas: "SP 1453", type: "فلتر فاصل ماء وسبيتر", oem: "Mann WK 1060 / FS 1280", app: "Cummins, DAF, Iveco Fleet" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50 transition">
                    <td className="p-3 font-mono-code font-bold text-black">{row.asas}</td>
                    <td className="p-3 text-neutral-700">{row.type}</td>
                    <td className="p-3 font-mono-code text-neutral-600">{row.oem}</td>
                    <td className="p-3 text-neutral-800 font-medium">{row.app}</td>
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setSearchQuery(row.asas);
                          scrollToCatalogAndFocus();
                        }}
                        className="text-blue-600 font-mono-code font-bold hover:underline"
                      >
                        عرض القطعة ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-right">
            <a
              href="https://wa.me/9647901526221?text=مرحباً محل العاني، لدي رقم فلتر وأود التأكد من مطابقة كود أساس له"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-mono-code font-bold hover:bg-emerald-700 transition"
            >
              <span>طلب مطابقة رقم OEM غير موجود عبر واتساب</span>
              <span>↗</span>
            </a>
          </div>

        </div>
      </section>

      {/* ========================================================== */}
      {/* 8. HALCYON SECTION 6: EDITORIAL HIGHLIGHTS & GUIDES        */}
      {/* ========================================================== */}
      <section className="bg-[#f8f8f8] py-16 sm:py-24 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="text-right max-w-xl mb-12">
            <span className="font-mono-code text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">
              TECHNICAL HIGHLIGHTS
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
              إرشادات هندسية من محل العاني
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                tag: "صيف العراق",
                title: "اختيار فلتر الدهن في درجات حرارة تتجاوز 50 مئوية",
                desc: "تتسبب درجات الحرارة المرتفعة في انخفاض لزوجة زيت المحرك. تضمن فلاتر أساس التركية المحافظة على معدل ضغط الزيت وصمامات مانعة للرجوع تتحمل حتى 150°C دون تآكل.",
              },
              {
                tag: "حماية المحرك",
                title: "5 علامات تكشف بها الفلاتر المقلدة والتجارية المغشوشة",
                desc: "من جودة اللحام النقطي للغلاف، مرونة حلقة الـ O-ring المطاطية، إلى كثافة الطيات الورقية. تعرف على أسرار فحص الفلتر قبل تركيبه في سيارتك أو آليتك.",
              },
              {
                tag: "الشاحنات والتريلات",
                title: "أهمية فلتر مجفف الهواء (Air Dryer) لفرامل الشاحنات",
                desc: "سحب الرطوبة والزيوت من شبكة الهواء يمنع تجمد أو تعطل صمامات الفرامل الهوائية وتلف خزانات الضغط في شاحنات سكانيا، أكتروس، وفولفو.",
              },
            ].map((art, idx) => (
              <div key={idx} className="bg-white border border-neutral-200 p-6 flex flex-col justify-between text-right hover:border-black transition">
                <div className="space-y-3">
                  <span className="font-mono-code text-[11px] font-bold text-neutral-500 uppercase px-2 py-0.5 bg-neutral-100 inline-block">
                    {art.tag}
                  </span>
                  <h3 className="font-bold text-base text-black leading-snug">{art.title}</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed font-sans">{art.desc}</p>
                </div>
                <div className="pt-4 border-t border-neutral-100 mt-4">
                  <a
                    href="https://wa.me/9647901526221"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono-code font-bold text-black hover:text-blue-600"
                  >
                    استشارة فنية عبر واتساب ↗
                  </a>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================== */}
      {/* 9. FAQ SECTION ACCORDION                                   */}
      {/* ========================================================== */}
      <section id="faq" className="bg-white py-16 sm:py-24 border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 text-right">
          
          <div className="mb-10 text-center">
            <span className="font-mono-code text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-1">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111]">
              الأسئلة الشائعة قبل الطلب
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "كيف أتأكد أن الفلتر يطابق سيارتي أو مولدتي أو آليتي؟",
                a: "يمكنك التحقق بمطابقة كود الفلتر في خانة البحث، أو عبر جدول مطابقة أرقام OEM، أو مراسلتنا مباشرة على واتساب بصورة الفلتر القديم أو موديل الآلية وسيقوم الفريق الفني بتأكيد الكود المطابق تماماً.",
              },
              {
                q: "هل فلاتر أساس أصلية ومعتمدة 100%؟",
                a: "نعم، نحن في محل العاني نتعامل مع وكالة فلاتر أساس ASAS Turkey التركية الأصلية مباشرة. جميع الفلاتر مصنعة وفق مواصفات المصانع العالمية ISO 9001 و TS 16949 ومطابقة للمواصفات الأصلية.",
              },
              {
                q: "هل الدفع عند الاستلام وما هي سياسة المعاينة؟",
                a: "نعم، جميع الطلبات تُشحن بنظام الدفع عند الاستلام (COD). يحق للزبون فتح الطرد ومعاينة الفلتر والتأكد من مطابقته وسلامته قبل تسليم المبلغ لمندوب شركة التوصيل.",
              },
              {
                q: "كم يستغرق التوصيل إلى محافظتي؟",
                a: "يتم تسليم الطرود يومياً لشركات التوصيل السريع. يستغرق التوصيل داخل بغداد 24-48 ساعة، وإلى باقي محافظات العراق الـ 17 من يومين إلى 4 أيام عمل.",
              },
            ].map((faq, idx) => (
              <details key={idx} className="group border border-neutral-200 bg-[#f8f8f8] p-4 cursor-pointer">
                <summary className="font-bold text-xs sm:text-sm text-black flex items-center justify-between list-none">
                  <span className="font-mono-code text-neutral-400 group-open:rotate-45 transition-transform text-sm">+</span>
                  <span>{faq.q}</span>
                </summary>
                <p className="mt-3 text-xs text-neutral-600 leading-relaxed font-sans pt-3 border-t border-neutral-200">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================== */}
      {/* 10. HALCYON 4-COLUMN ARCHITECTURAL FOOTER                  */}
      {/* ========================================================== */}
      <footer className="bg-[#111111] text-white py-14 sm:py-20 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-right">
            
            {/* Col 1: Brand & Location */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 justify-end">
                <div className="flex flex-col text-right">
                  <span className="font-extrabold text-base tracking-tight leading-none text-white">
                    محل العاني للفلتر
                  </span>
                  <span className="text-[10px] font-mono-code text-neutral-400 uppercase tracking-wider">
                    ASAS FILTER AGENCY
                  </span>
                </div>
                <Image 
                  src="/logo_a_trans.png" 
                  alt="العاني" 
                  width={30} 
                  height={30} 
                  className="h-8 w-auto object-contain" 
                />
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                بغداد، العراق • فلاتر أصلية معتمدة للسيارات والمولدات والمعدات الثقيلة والشاحنات. توصيل لكافة المحافظات والدفع نقداً عند الاستلام.
              </p>
              <div className="text-[11px] font-mono-code text-neutral-500">
                <span>سوق السنك التجاري، بغداد</span>
              </div>
            </div>

            {/* Col 2: Direct Contact */}
            <div className="space-y-3 font-mono-code text-xs">
              <span className="text-neutral-400 font-bold uppercase tracking-wider block border-b border-neutral-800 pb-2">
                CONTACT & INQUIRIES
              </span>
              <div className="space-y-2">
                <div>
                  <span className="text-neutral-500 text-[10px] block">الرقم الأساسي / واتساب:</span>
                  <a href="https://wa.me/9647901526221" target="_blank" rel="noopener noreferrer" className="text-white hover:text-emerald-400 font-bold">
                    +964 790 152 6221
                  </a>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">الرقم الثاني / اتصال مباشر:</span>
                  <a href="tel:+9647710077880" className="text-white hover:text-emerald-400 font-bold">
                    +964 771 007 7880
                  </a>
                </div>
              </div>
            </div>

            {/* Col 3: Navigation */}
            <div className="space-y-3 text-xs">
              <span className="font-mono-code text-neutral-400 font-bold uppercase tracking-wider block border-b border-neutral-800 pb-2">
                NAVIGATION
              </span>
              <ul className="space-y-2 text-neutral-300">
                <li><a href="#catalog" className="hover:text-white transition">كتالوج الفلاتر (80)</a></li>
                <li><a href="#engineering" className="hover:text-white transition">الهندسة والجودة الأصلية</a></li>
                <li><a href="#oem-lookup" className="hover:text-white transition">مطابقة أرقام المصنع OEM</a></li>
                <li><a href="#faq" className="hover:text-white transition">الشحن والضمان</a></li>
                <li>
                  <Link href="/admin" className="font-mono-code text-[11px] text-blue-400 hover:text-blue-300">
                    لوحة الإدارة [PIN: 12345678]
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: COD & Inspection Guarantee */}
            <div className="space-y-3 text-xs">
              <span className="font-mono-code text-neutral-400 font-bold uppercase tracking-wider block border-b border-neutral-800 pb-2">
                IRAQ-WIDE GUARANTEE
              </span>
              <div className="space-y-2 text-neutral-300">
                <p className="leading-relaxed">
                  🚚 شحن لجميع محافظات العراق الـ 18.
                </p>
                <p className="leading-relaxed">
                  📦 فحص ومعاينة الطرد قبل تسليم المبلغ للمندوب.
                </p>
                <p className="leading-relaxed font-mono-code text-[11px] text-emerald-400">
                  ✓ فلاتر أساس أصلية 100%
                </p>
              </div>
            </div>

          </div>

          <div className="mt-12 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono-code text-neutral-500 gap-3">
            <span>حقوق النشر © {new Date().getFullYear()} محل العاني للفلتر. جميع الحقوق محفوظة.</span>
            <span>ASAS FILTERS IRAQ • POWERED BY HALCYON ARCHITECTURE</span>
          </div>

        </div>
      </footer>

      {/* ========================================================== */}
      {/* 11. HALCYON PRODUCT DETAIL VIEW (Pic 2, 3, 4 Exact Layout) */}
      {/* ========================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white text-black w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-neutral-300 shadow-2xl relative my-auto">
            
            {/* Back Button matching Halcyon Pic 2 */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-xs font-mono-code font-bold uppercase tracking-wider text-black flex items-center gap-1.5 transition"
              >
                <span>&lt; BACK</span>
              </button>
              <span className="font-mono-code text-xs text-neutral-400 uppercase">ASAS FILTER CATALOG</span>
            </div>

            <div className="p-6 sm:p-8 space-y-6 text-right">
              
              {/* Product Gallery Studio Image */}
              <div className="bg-[#f8f8f8] border border-neutral-200 aspect-square max-w-md mx-auto relative flex items-center justify-center p-6">
                <Image
                  src={selectedProduct.image_url}
                  alt={selectedProduct.title}
                  width={400}
                  height={400}
                  className="object-contain max-h-full max-w-full"
                  priority
                />
              </div>

              {/* Title Section (Pic 2 Architecture) */}
              <div className="space-y-2 border-b border-neutral-200 pb-6">
                <h2 className="text-3xl sm:text-5xl font-black font-mono-code text-black tracking-tight">
                  {selectedProduct.part_number || selectedProduct.title}
                </h2>
                <p className="text-sm sm:text-base text-neutral-700 font-sans font-medium">
                  {selectedProduct.title}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono-code font-bold">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>25 متوفر في مخزن بغداد</span>
                  </span>
                  <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 border border-blue-200">
                    <span>🟢 شحن سريع لكافة المحافظات 18</span>
                  </span>
                </div>
              </div>

              {/* Price & Quantity Stepper & Add to Cart (Pic 3 Architecture) */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-neutral-500 text-xs font-mono-code uppercase">السعر الفردي:</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono-code">
                    {formatIQD(selectedProduct.price)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-neutral-300 h-12 px-2 font-mono-code font-bold">
                    <button
                      onClick={() => setProductQty(Math.max(1, productQty - 1))}
                      className="w-8 h-full flex items-center justify-center text-lg hover:text-neutral-500"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-sm">{productQty}</span>
                    <button
                      onClick={() => setProductQty(productQty + 1)}
                      className="w-8 h-full flex items-center justify-center text-lg hover:text-neutral-500"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => {
                      addToCart(selectedProduct, productQty);
                      setSelectedProduct(null);
                      setIsCartDrawerOpen(true);
                    }}
                    className="flex-1 h-12 bg-[#111111] hover:bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <span>إضافة إلى السلة وإتمام الطلب</span>
                    <span className="font-mono-code text-xs">({formatIQD(selectedProduct.price * productQty)})</span>
                  </button>
                </div>
              </div>

              {/* Exact Specifications Table (Pic 3 & Pic 4) */}
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
      {/* 12. HALCYON SLIDE-OVER CART DRAWER & COD FORM              */}
      {/* ========================================================== */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="bg-white text-black w-full max-w-md h-full flex flex-col justify-between border-l border-neutral-200 shadow-2xl relative">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-6 border-b border-neutral-200 flex items-center justify-between">
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="text-xs font-mono-code font-bold text-neutral-500 hover:text-black uppercase"
              >
                [ إغلاق ✕ ]
              </button>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">سلة المشتريات</span>
                <span className="font-mono-code text-xs px-2 py-0.5 bg-black text-white font-bold">
                  {cartCount}
                </span>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <span className="font-mono-code text-3xl">🛒</span>
                  <p className="text-sm font-bold text-neutral-700">السلة فارغة حالياً</p>
                  <p className="text-xs text-neutral-500">اختر الفلاتر المطلوبة من الكتالوج لإتمام الشراء</p>
                  <button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      scrollToCatalogAndFocus();
                    }}
                    className="mt-4 px-4 py-2 bg-black text-white text-xs font-mono-code font-bold"
                  >
                    استعراض الفلاتر
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="border border-neutral-200 p-3 flex gap-3 text-right bg-[#fcfcfc]"
                    >
                      <div className="w-16 h-16 bg-white border border-neutral-100 relative shrink-0 p-1">
                        <Image
                          src={item.product.image_url}
                          alt={item.product.title}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <span className="font-mono-code text-xs font-bold text-black uppercase block">
                            {item.product.part_number || item.product.title}
                          </span>
                          <p className="text-[11px] text-neutral-600 line-clamp-1">{item.product.title}</p>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center border border-neutral-300 font-mono-code text-xs">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="px-2 py-0.5 hover:bg-neutral-100"
                            >
                              -
                            </button>
                            <span className="px-2 font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="px-2 py-0.5 hover:bg-neutral-100"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-mono-code text-xs font-bold text-black">
                            {formatIQD(item.product.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout & Delivery Calculation */}
            {cart.length > 0 && (
              <div className="border-t border-neutral-200 p-4 sm:p-6 bg-[#f8f8f8] space-y-4">
                
                {/* Cost Breakdown */}
                <div className="space-y-1.5 font-mono-code text-xs text-neutral-600 border-b border-neutral-200 pb-3">
                  <div className="flex justify-between">
                    <span className="text-black font-bold">{formatIQD(cartSubtotal)}</span>
                    <span>المجموع الفرعي:</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black font-bold">{formatIQD(deliveryFee)}</span>
                    <span>أجور التوصيل ({custGov}):</span>
                  </div>
                  <div className="flex justify-between text-sm text-black font-extrabold pt-1">
                    <span>{formatIQD(orderTotal)}</span>
                    <span>الإجمالي عند الاستلام:</span>
                  </div>
                </div>

                {/* Customer Checkout Form */}
                <form onSubmit={handlePlaceOrder} className="space-y-2.5 text-right">
                  <div>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="الاسم الكامل *"
                      className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-right focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      required
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="رقم الهاتف العراقي (مثال: 07901234567) *"
                      className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-right font-mono-code focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <select
                      value={custGov}
                      onChange={handleGovChange}
                      className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-right focus:outline-none focus:border-black font-sans"
                    >
                      {GOVERNORATES.map((g) => (
                        <option key={g.name} value={g.name} data-fee={g.fee}>
                          {g.name} (توصيل: {formatIQD(g.fee)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      required
                      value={custAddress}
                      onChange={(e) => setCustAddress(e.target.value)}
                      placeholder="العنوان التفصيلي / نقطة دالة *"
                      className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-right focus:outline-none focus:border-black"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#111111] hover:bg-black text-white text-xs font-mono-code font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  >
                    <span>تأكيد الطلب والدفع عند الاستلام</span>
                    <span>({formatIQD(orderTotal)})</span>
                  </button>
                </form>

              </div>
            )}

          </div>
        </div>
      )}

      {/* Order Confirmed Modal with WhatsApp Redirection */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white text-black max-w-md w-full p-6 sm:p-8 text-center space-y-4 border border-neutral-300 shadow-2xl">
            <span className="text-4xl">🎉</span>
            <h3 className="font-extrabold text-lg text-black">تم تسجيل طلبك بنجاح!</h3>
            <p className="font-mono-code text-xs text-neutral-500 font-bold">
              رقم الطلب: {orderConfirmed.id}
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed font-sans">
              المجموع الإجمالي: <span className="font-bold text-black">{formatIQD(orderConfirmed.total)}</span>
              <br />
              الشحن إلى: <span className="font-bold text-black">{orderConfirmed.gov}</span> (الدفع نقداً عند المعاينة والاستلام).
            </p>
            
            <div className="pt-2 space-y-2">
              <a
                href={orderConfirmed.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono-code font-bold uppercase tracking-wider"
              >
                تأكيد فوري عبر واتساب المحل ↗
              </a>
              <button
                onClick={() => setOrderConfirmed(null)}
                className="w-full py-2 border border-neutral-300 text-xs font-mono-code text-neutral-700 hover:bg-neutral-50"
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
