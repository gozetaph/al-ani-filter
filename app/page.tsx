"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatIQD } from "@/lib/utils";
import { Product, Order, CartItem } from "@/lib/types";
import { initialProducts, sampleOrders } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const [view, setView] = useState<"store" | "admin">("store");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedWaybillOrder, setSelectedWaybillOrder] = useState<Order | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);

  // Checkout Form State
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custGov, setCustGov] = useState("Baghdad");
  const [deliveryFee, setDeliveryFee] = useState(5000);
  const [custArea, setCustArea] = useState("");

  // New Product Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<"systems" | "cartridges" | "parts">("cartridges");
  const [newPrice, setNewPrice] = useState(15000);
  const [newStock, setNewStock] = useState(10);
  const [newDesc, setNewDesc] = useState("");

  const supabase = createClient();

  // Load products from Supabase if configured
  useEffect(() => {
    async function fetchFromSupabase() {
      try {
        const { data: dbProducts, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && dbProducts && dbProducts.length > 0) {
          setProducts(dbProducts);
        }
      } catch {
        // Fallback to local state
      }
    }
    fetchFromSupabase();
  }, [supabase]);

  // Cart calculations
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderTotal = cartSubtotal + deliveryFee;

  // Cart Actions
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert("عذراً، هذه أقصى كمية متوفرة في المستودع حالياً.");
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

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }
      if (newQty > item.product.stock_quantity) {
        alert("أقصى كمية متوفرة حالياً بالمخزن.");
        return prev;
      }
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i));
    });
  };

  // Governorate change
  const handleGovChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    setCustGov(selectedOption.value);
    setDeliveryFee(parseInt(selectedOption.getAttribute("data-fee") || "5000"));
  };

  // Place Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = "AF-" + Math.floor(1090 + Math.random() * 800);
    const itemsSummary = cart.map((i) => `${i.product.title} × ${i.quantity}`).join("، ");

    const newOrder: Order = {
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
      notes: itemsSummary,
      created_at: new Date().toISOString(),
    };

    // Try sending to Supabase
    try {
      await supabase.from("orders").insert([
        {
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
          notes: itemsSummary,
        },
      ]);
    } catch {
      // Handled gracefully
    }

    // Deduct stock locally
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((c) => c.product.id === p.id);
        if (cartMatch) {
          return { ...p, stock_quantity: Math.max(0, p.stock_quantity - cartMatch.quantity) };
        }
        return p;
      })
    );

    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setIsCheckoutOpen(false);

    alert(`تم تسجيل طلبك بنجاح برقم #${orderId}!\nالمبلغ المطلوب نقداً عند الاستلام: ${formatIQD(orderTotal)}`);
    setView("admin");
  };

  // Admin Quick Stock
  const handleQuickStock = (productId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, stock_quantity: Math.max(0, p.stock_quantity + delta) } : p
      )
    );
  };

  // Add Product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newProd: Product = {
      id: (products.length + 1).toString(),
      title: newTitle,
      slug: "prod-" + Date.now(),
      category: newCategory,
      price: newPrice,
      stock_quantity: newStock,
      description: newDesc || "منتج أصلي معتمد من شركة العاني للفلتر.",
      image_url: newCategory === "systems" ? "/products/ro-system.jpg" : (newCategory === "cartridges" ? "/products/cartridges.png" : "/products/pump.png"),
      badge: "جديد",
      is_active: true,
    };
    setProducts((prev) => [newProd, ...prev]);
    setIsAddProductOpen(false);
    alert("تمت إضافة المنتج بنجاح للمخزن والمتجر.");
  };

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const totalSales = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const lowStockCount = products.filter((p) => p.stock_quantity <= 3).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      
      {/* 1. LIQUID GLASS FLOATING HEADER */}
      <header className="sticky top-0 z-40 liquid-glass">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div
            className="flex items-center gap-3.5 cursor-pointer select-none"
            onClick={() => setView("store")}
          >
            <div className="h-9 px-3 bg-[#004bb5] text-white rounded-lg flex items-center justify-center font-black text-sm tracking-tight shadow-sm">
              AL ANI
            </div>
            <div>
              <span className="font-bold text-base text-neutral-900 tracking-tight flex items-center gap-2">
                العاني للفلتر
                <span className="text-[11px] font-medium text-neutral-400 border-r border-neutral-200 pr-2 font-mono">
                  alanifilter.com
                </span>
              </span>
            </div>
          </div>

          {/* Segmented View Switcher */}
          <nav className="hidden md:flex items-center bg-neutral-200/60 p-1 rounded-full border border-black/[0.04]">
            <button
              onClick={() => setView("store")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                view === "store"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              المتجر والمنتجات
            </button>
            <button
              onClick={() => setView("admin")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                view === "admin"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              لوحة الإدارة والطلبيات
            </button>
          </nav>

          {/* Cart Trigger */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setView(view === "store" ? "admin" : "store")}
              className="md:hidden text-xs bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full font-medium text-neutral-700"
            >
              {view === "store" ? "لوحة الإدارة" : "المتجر"}
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>السلة</span>
              <span className="bg-white text-neutral-900 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartItemCount}
              </span>
            </button>
          </div>

        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. STOREFRONT VIEW                                        */}
      {/* ========================================================= */}
      {view === "store" && (
        <main className="flex-1 pb-24">
          
          {/* Hero Statement */}
          <section className="max-w-5xl mx-auto px-5 pt-16 pb-12 text-center">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">
              أنظمة التناضح العكسي • تحلية وتنقية المياه في العراق
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-neutral-900 leading-[1.15] max-w-3xl mx-auto">
              مياه نقية كما ينبغي للطبيعة أن تكون.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-neutral-500 max-w-xl mx-auto font-normal leading-relaxed">
              منظومات فلترة متطورة، فلاتر وممبرين كورية وتايوانية أصلية بكفالة حقيقية وتوصيل سريع مع الدفع عند الاستلام.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#productsSection"
                className="bg-neutral-900 hover:bg-black text-white text-sm font-semibold px-6 py-2.5 rounded-full transition shadow-sm"
              >
                تصفح المنتجات
              </a>
              <button
                onClick={() => setSelectedCategory("systems")}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-semibold px-5 py-2.5 rounded-full transition"
              >
                منظومات R.O
              </button>
            </div>

            {/* Spec Bar */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-neutral-200/70 text-right md:text-center">
              <div>
                <span className="block text-xl font-bold text-neutral-900">99.8%</span>
                <span className="text-xs text-neutral-500">نسبة عزل الأملاح والشوائب</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-neutral-900">سنة كاملة</span>
                <span className="text-xs text-neutral-500">ضمان وكفالة حقيقية</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-neutral-900">18 محافظة</span>
                <span className="text-xs text-neutral-500">توصيل لباب بيتك بالعراق</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-neutral-900">COD</span>
                <span className="text-xs text-neutral-500">افحص ثم ادفع عند الاستلام</span>
              </div>
            </div>
          </section>

          {/* Hero Feature Card: Flagship System */}
          <section className="max-w-6xl mx-auto px-5 mb-14">
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-black/[0.04] shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
              <div className="max-w-md space-y-4 z-10">
                <span className="inline-block bg-neutral-100 text-neutral-800 text-xs font-semibold px-3 py-1 rounded-full">
                  المنظومة الأكثر مبيعاً في العراق
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900 leading-tight">
                  العاني R.O الجيل السابع
                </h2>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  7 مراحل ترشيح دقيقة تشمل غشاء التناضح العكسي (Membrane 75GPD)، وحدة تعديل القلوية (Alkaline pH) ومضخة ماء صامتة بقدرة تحمّل فائقة.
                </p>
                <div className="pt-2 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-neutral-900">185,000 د.ع</span>
                  <span className="text-xs text-neutral-400 font-medium">شامل خزان الضغط والصنبور والملحقات</span>
                </div>
                <div className="pt-3 flex gap-3">
                  <button
                    onClick={() => {
                      const flagship = products.find((p) => p.category === "systems") || products[0];
                      addToCart(flagship);
                    }}
                    className="bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold px-6 py-2.5 rounded-full shadow-sm transition active:scale-95"
                  >
                    طلب مباشر للمنظومة
                  </button>
                  <button
                    onClick={() => setIsSpecsOpen(true)}
                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold px-5 py-2.5 rounded-full transition"
                  >
                    المواصفات الفنية
                  </button>
                </div>
              </div>

              {/* Real Flagship Photo */}
              <div className="w-full md:w-1/2 flex items-center justify-center p-4">
                <div className="w-full max-w-sm h-72 rounded-3xl bg-gradient-to-tr from-sky-50/60 via-white to-blue-50/50 border border-black/[0.04] flex flex-col items-center justify-center shadow-inner relative p-4 overflow-hidden">
                  <Image
                    src="/products/ro-system.jpg"
                    alt="العاني R.O 7 مراحل"
                    width={280}
                    height={280}
                    className="h-52 w-auto object-contain drop-shadow-lg hover:scale-105 transition duration-500"
                    priority
                  />
                  <div className="absolute bottom-3 text-[11px] bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-black/[0.05] text-neutral-800 font-bold shadow-xs">
                    7 مراحل تحلية • تايواني وكوري معتمد
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Product Grid & Categories */}
          <section id="productsSection" className="max-w-6xl mx-auto px-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-200/70">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">جميع المنتجات والقطع</h2>
                <p className="text-xs text-neutral-500 mt-0.5">شمعات التبديل، مضخات، ملحقات فحص وأجهزة منزلية</p>
              </div>

              {/* Segmented Filter */}
              <div className="bg-neutral-100 p-1 rounded-full flex gap-1 border border-black/[0.03]">
                {[
                  { key: "all", label: "الكل" },
                  { key: "systems", label: "منظومات تحلية" },
                  { key: "cartridges", label: "شمعات وممبرين" },
                  { key: "parts", label: "مضخات وملحقات" },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${
                      selectedCategory === cat.key
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((prod) => {
                const isLow = prod.stock_quantity <= 3 && prod.stock_quantity > 0;
                const isOut = prod.stock_quantity <= 0;

                return (
                  <div key={prod.id} className="liquid-card rounded-3xl p-6 flex flex-col justify-between group">
                    <div>
                      <div className="h-48 rounded-2xl bg-[#f5f5f7] flex items-center justify-center p-4 mb-4 relative overflow-hidden">
                        <Image
                          src={prod.image_url}
                          alt={prod.title}
                          width={180}
                          height={180}
                          className="h-40 max-w-[90%] object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                        />
                        {prod.badge && (
                          <span className="absolute top-3 right-3 bg-neutral-900 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                            {prod.badge}
                          </span>
                        )}
                        {isLow && (
                          <span className="absolute bottom-2 left-2 bg-amber-500/15 text-amber-800 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            متبقي {prod.stock_quantity} قطع فقط
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-neutral-900 text-base leading-snug mb-1.5">{prod.title}</h3>
                      <p className="text-neutral-500 text-xs leading-relaxed line-clamp-2">{prod.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-medium text-neutral-400 block">السعر</span>
                        <span className="text-base font-extrabold text-neutral-900">{formatIQD(prod.price)}</span>
                      </div>
                      <button
                        onClick={() => addToCart(prod)}
                        disabled={isOut}
                        className="bg-neutral-900 hover:bg-black disabled:bg-neutral-200 text-white text-xs font-semibold px-4 py-2 rounded-full transition shadow-xs active:scale-95"
                      >
                        {isOut ? "نافد بالمخزن" : "إضافة للسلة"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </main>
      )}

      {/* ========================================================= */}
      {/* 3. ADMIN DASHBOARD VIEW                                   */}
      {/* ========================================================= */}
      {view === "admin" && (
        <section className="flex-1 pb-24 max-w-6xl mx-auto px-5 pt-8 w-full">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-neutral-200/70">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                  AL ANI CONSOLE
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">إدارة المخزون والطلبيات</h1>
            </div>
            <button
              onClick={() => setIsAddProductOpen(true)}
              className="bg-neutral-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm transition"
            >
              + إضافة بضاعة جديدة
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-black/[0.05] shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                إجمالي المبيعات المؤكدة
              </span>
              <h3 className="text-3xl font-bold text-neutral-900 tracking-tight">{formatIQD(totalSales)}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">تحديث تلقائي وفوري</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-black/[0.05] shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                الطلبيات النشطة
              </span>
              <h3 className="text-3xl font-bold text-neutral-900 tracking-tight">{orders.length}</h3>
              <p className="text-[11px] text-neutral-400 font-medium mt-1">بانتظار التسليم للشاحن</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-black/[0.05] shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                تنبيهات المخزون
              </span>
              <h3 className="text-3xl font-bold text-amber-600 tracking-tight">{lowStockCount}</h3>
              <p className="text-[11px] text-amber-600 font-medium mt-1">قطع وصلت لحد النفاد</p>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl border border-black/[0.05] shadow-xs overflow-hidden mb-8">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">سجل طلبيات الشحن والتوصيل</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                توليد بوليصة الشحن (AWB) بضغطة واحدة أو إرسال التفاصيل مباشرة للسائق
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-50/70 text-neutral-400 font-semibold border-b border-neutral-100">
                  <tr>
                    <th className="p-4">الكود</th>
                    <th className="p-4">الزبون</th>
                    <th className="p-4">المحافظة والعنوان</th>
                    <th className="p-4">المواد المطلوبة</th>
                    <th className="p-4">المبلغ عند الباب (COD)</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">إجراءات الإرسال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-neutral-50/50 transition">
                      <td className="p-4 font-bold text-neutral-900 font-mono">#{ord.id}</td>
                      <td className="p-4">
                        <span className="font-bold text-neutral-900 block">{ord.customer_name}</span>
                        <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                          {ord.phone}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="bg-neutral-100 text-neutral-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {ord.governorate}
                        </span>
                        <p className="text-neutral-500 text-[11px] mt-0.5">{ord.detailed_address}</p>
                      </td>
                      <td className="p-4 text-[11px] text-neutral-600 max-w-xs">{ord.notes}</td>
                      <td className="p-4">
                        <span className="font-extrabold text-neutral-900">{formatIQD(ord.total_amount)}</span>
                        <span className="text-[10px] text-emerald-600 block">نقد عند الباب</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-800 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          {ord.status === "dispatched" ? "مع المندوب" : "قيد التجهيز"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => setSelectedWaybillOrder(ord)}
                            className="bg-neutral-900 hover:bg-black text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs"
                          >
                            بوليصة AWB
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(
                              `*طلب توصيل - العاني للفلتر*\nكود الطلب: #${ord.id}\nالزبون: ${ord.customer_name}\nالهاتف: ${ord.phone}\nالمحافظة: ${ord.governorate} - ${ord.detailed_address}\nالمواد: ${ord.notes}\n*المطلوب نقداً (COD): ${formatIQD(ord.total_amount)}*`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1"
                          >
                            واتساب
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-3xl border border-black/[0.05] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">المخزون والتحكم بالكميات</h2>
              <p className="text-xs text-neutral-400 mt-0.5">تعديل مباشر على كميات الفلاتر المتوفرة بالمستودع</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-50/70 text-neutral-400 font-semibold border-b border-neutral-100">
                  <tr>
                    <th className="p-4">اسم المادة</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">السعر</th>
                    <th className="p-4">المتوفر بالمخزن</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">تعديل فوري للكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={p.image_url}
                            alt={p.title}
                            width={36}
                            height={36}
                            className="w-9 h-9 object-contain rounded-lg bg-white border border-neutral-200/70 p-0.5"
                          />
                          <span className="font-bold text-neutral-900">{p.title}</span>
                        </div>
                      </td>
                      <td className="p-4 text-neutral-500">{p.category}</td>
                      <td className="p-4 font-bold text-neutral-900">{formatIQD(p.price)}</td>
                      <td className="p-4">
                        <span className={`font-bold ${p.stock_quantity <= 3 ? "text-amber-600" : "text-neutral-900"}`}>
                          {p.stock_quantity} قطعة
                        </span>
                      </td>
                      <td className="p-4">
                        {p.stock_quantity > 3 ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            متوفر بالمخزن
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            قارب على النفاد ⚠️
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center bg-neutral-100 rounded-full px-2 py-0.5">
                          <button
                            onClick={() => handleQuickStock(p.id, -1)}
                            className="w-5 text-neutral-600 font-bold hover:text-black"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold text-xs font-mono">{p.stock_quantity}</span>
                          <button
                            onClick={() => handleQuickStock(p.id, 1)}
                            className="w-5 text-neutral-600 font-bold hover:text-black"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      )}

      {/* ========================================================= */}
      {/* 4. CART SLIDE-OVER                                        */}
      {/* ========================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-r border-black/[0.05]">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">سلة المشتريات</h2>
                <span className="text-xs text-neutral-400">{cartItemCount} مواد مضافة</span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-neutral-400 space-y-2">
                  <span className="text-3xl">🛒</span>
                  <p className="font-medium text-xs">سلتك فارغة حالياً</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.product.id}
                    className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={c.product.image_url}
                        alt={c.product.title}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain rounded-xl bg-white border border-neutral-200/60 p-1"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-neutral-900 leading-tight">{c.product.title}</h4>
                        <span className="text-xs text-neutral-500 font-semibold">{formatIQD(c.product.price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center bg-white border border-neutral-200 rounded-full px-2 py-0.5">
                      <button
                        onClick={() => changeQuantity(c.product.id, -1)}
                        className="w-5 text-neutral-500 hover:text-black font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold font-mono">{c.quantity}</span>
                      <button
                        onClick={() => changeQuantity(c.product.id, 1)}
                        className="w-5 text-neutral-500 hover:text-black font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-neutral-50/80 border-t border-neutral-100 space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-neutral-600">المجموع الفرعي</span>
                <span className="text-xl font-bold text-neutral-900">{formatIQD(cartSubtotal)}</span>
              </div>
              <p className="text-[11px] text-neutral-400">أجور التوصيل تُحسب حسب محافظتك في الخطوة القادمة.</p>
              <button
                disabled={cart.length === 0}
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white py-3 rounded-full text-xs font-semibold shadow-sm transition active:scale-98"
              >
                إتمام الطلب (الدفع عند الاستلام)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. CHECKOUT MODAL                                         */}
      {/* ========================================================= */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-black/[0.05] overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest block">
                  SECURE CHECKOUT
                </span>
                <h2 className="text-xl font-bold text-neutral-900">تفاصيل التوصيل والاستلام</h2>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">الاسم الكامل للمستلم *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله الهاشمي"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="0770 123 4567"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white text-right font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">المحافظة *</label>
                  <select
                    onChange={handleGovChange}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0071e3] text-xs"
                  >
                    <option value="Baghdad" data-fee="5000">بغداد (5,000 د.ع)</option>
                    <option value="Erbil" data-fee="6000">أربيل (6,000 د.ع)</option>
                    <option value="Basra" data-fee="7000">البصرة (7,000 د.ع)</option>
                    <option value="Sulaymaniyah" data-fee="6000">السليمانية (6,000 د.ع)</option>
                    <option value="Najaf" data-fee="7000">النجف (7,000 د.ع)</option>
                    <option value="Karbala" data-fee="7000">كربلاء (7,000 د.ع)</option>
                    <option value="Babil" data-fee="7000">بابل (7,000 د.ع)</option>
                    <option value="Kirkuk" data-fee="6000">كركوك (6,000 د.ع)</option>
                    <option value="Nineveh" data-fee="7000">نينوى (7,000 د.ع)</option>
                    <option value="Anbar" data-fee="7000">الأنبار (7,000 د.ع)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">المنطقة والشارع *</label>
                  <input
                    type="text"
                    required
                    value={custArea}
                    onChange={(e) => setCustArea(e.target.value)}
                    placeholder="مثال: المنصور، شارع 14 رمضان"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white text-xs"
                  />
                </div>
              </div>

              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 space-y-2">
                <div className="flex justify-between text-neutral-500">
                  <span>ثمن البضاعة</span>
                  <span className="font-semibold text-neutral-900">{formatIQD(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>أجور التوصيل</span>
                  <span className="font-semibold text-[#0071e3]">{formatIQD(deliveryFee)}</span>
                </div>
                <div className="border-t border-neutral-200/60 pt-2 flex justify-between items-baseline">
                  <span className="font-bold text-neutral-900">المجموع المطلوب نقداً عند الاستلام</span>
                  <span className="text-base font-extrabold text-neutral-900">{formatIQD(orderTotal)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-neutral-900 hover:bg-black text-white py-3 rounded-full font-semibold transition shadow-sm"
                >
                  تأكيد الطلب الآن
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-5 py-3 border border-neutral-200 rounded-full text-neutral-600 font-medium hover:bg-neutral-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. PRINTABLE AIR WAYBILL MODAL                            */}
      {/* ========================================================= */}
      {selectedWaybillOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-black/[0.05] overflow-hidden">
            <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
              <span className="text-xs font-semibold">بوليصة الشحن الرسمية للمندوب (AWB)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs px-3.5 py-1.5 rounded-full font-semibold"
                >
                  طباعة
                </button>
                <button onClick={() => setSelectedWaybillOrder(null)} className="text-neutral-400 hover:text-white text-sm p-1">
                  ✕
                </button>
              </div>
            </div>

            <div id="printArea" className="p-8 space-y-6">
              <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-neutral-900">العاني للفلتر • AL ANI</h2>
                  <p className="text-[11px] text-neutral-400 font-mono">BAGHDAD, IRAQ • SHIPMENT MANIFEST</p>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-neutral-400 block font-mono">TRACKING CODE</span>
                  <span className="text-base font-black font-mono text-neutral-900">#{selectedWaybillOrder.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5 text-[10px]">المستلم</span>
                  <p className="font-bold text-neutral-900">{selectedWaybillOrder.customer_name}</p>
                  <p className="text-neutral-500 font-mono mt-0.5" dir="ltr">{selectedWaybillOrder.phone}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <span className="text-neutral-400 block mb-0.5 text-[10px]">المحافظة والعنوان</span>
                  <p className="font-bold text-neutral-900">{selectedWaybillOrder.governorate}</p>
                  <p className="text-neutral-500 mt-0.5 truncate">{selectedWaybillOrder.detailed_address}</p>
                </div>
              </div>

              <div className="border border-neutral-200 rounded-xl p-3 text-xs">
                <span className="text-[10px] font-semibold text-neutral-400 block mb-1">المحتويات في الطرد:</span>
                <p className="font-medium text-neutral-800">{selectedWaybillOrder.notes}</p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
                <span className="text-[11px] font-bold text-amber-800 tracking-wider uppercase block">
                  المبلغ المطلوب تحصيله نقداً من الزبون (COD)
                </span>
                <p className="text-3xl font-extrabold text-amber-900 tracking-tight mt-1">
                  {formatIQD(selectedWaybillOrder.total_amount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-black/[0.05] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900">إضافة مادة جديدة للمخزن</h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">اسم المادة / الفلتر *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: شمعة كربون نشط بلوك"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">التصنيف</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5"
                  >
                    <option value="systems">منظومات تحلية</option>
                    <option value="cartridges">شمعات وممبرين</option>
                    <option value="parts">مضخات وملحقات</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">الكمية بالمخزن</label>
                  <input
                    type="number"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">السعر (د.ع) *</label>
                <input
                  type="number"
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(parseInt(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">وصف مختصر</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="كفاءة عالية معتمدة عالمياً..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" className="flex-1 bg-neutral-900 text-white font-semibold py-2.5 rounded-full">
                  حفظ بالمخزن
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2.5 border rounded-full"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Specs Modal */}
      {isSpecsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-black/[0.05] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900">المواصفات الفنية المعتمدة</h3>
              <button onClick={() => setIsSpecsOpen(false)} className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">✕</button>
            </div>
            <div className="space-y-2.5 text-xs text-neutral-600 leading-relaxed">
              <div className="flex justify-between border-b border-neutral-100 pb-1.5">
                <span className="font-semibold text-neutral-800">نوع التقنية:</span>
                <span>تناضح عكسي (Reverse Osmosis)</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1.5">
                <span className="font-semibold text-neutral-800">سعة الإنتاج اليومية:</span>
                <span>75 غالون / حوالي 280 لتر يومياً</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1.5">
                <span className="font-semibold text-neutral-800">بلد المنشأ للقطع الحساسة:</span>
                <span>ممبرين ومضخة تايواني وكوري معتمد</span>
              </div>
              <div className="flex justify-between border-b border-neutral-100 pb-1.5">
                <span className="font-semibold text-neutral-800">الضمان:</span>
                <span>12 شهر شامل الصيانة وتوفير قطع الغيار</span>
              </div>
            </div>
            <button onClick={() => setIsSpecsOpen(false)} className="w-full bg-neutral-900 text-white text-xs font-semibold py-2.5 rounded-full">
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
