"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/lib/types";
import { initialProducts, initialFaqs } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [faqCount, setFaqCount] = useState(initialFaqs.length);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // 1. Local custom items check
      const localCustom = localStorage.getItem("al_ani_custom_items");
      if (localCustom) {
        try {
          const parsed = JSON.parse(localCustom);
          if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
        } catch {
          // ignore
        }
      }

      // 2. Load products from Supabase
      try {
        const { data, error } = await supabase.from("products").select("*");
        if (!error && data && data.length > 0) {
          setProducts(data);
        }
      } catch {
        // Fallback
      }

      // 3. Load FAQs count
      try {
        const { data } = await supabase.from("faqs").select("id");
        if (data && data.length > 0) setFaqCount(data.length);
      } catch {
        // Fallback
      }
    }
    loadData();
  }, [supabase]);

  const totalFilters = products.length;
  
  // Group by categories
  const categoriesList = [
    { key: "دهن", label: "فلاتر دهن (زيت)", color: "bg-blue-500" },
    { key: "هواء", label: "فلاتر هواء", color: "bg-amber-500" },
    { key: "وقود", label: "فلاتر وقود وديزل", color: "bg-emerald-500" },
    { key: "مجفف", label: "مجفف هواء شاحنات", color: "bg-purple-500" },
    { key: "كابينة", label: "فلاتر كابينة وتكييف", color: "bg-cyan-500" },
  ];

  const categoryStats = categoriesList.map((cat) => {
    const count = products.filter((p) =>
      (p.type || p.category || "").includes(cat.key)
    ).length;
    const percentage = totalFilters > 0 ? Math.round((count / totalFilters) * 100) : 0;
    return { ...cat, count, percentage };
  });

  return (
    <div className="space-y-6 text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      
      {/* ── TOP HERO HEADER BAR ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            لوحة التحكم الرئيسية
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-semibold">
            نظرة شاملة على مواد الكتالوج، الماركات البديلة، والأسئلة الشائعة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/items"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
          >
            <span>+ إضافة مادة للمخزون</span>
          </Link>
          <Link
            href="/admin/faq"
            className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold rounded-xl transition border border-neutral-800"
          >
            <span>الأسئلة الشائعة</span>
          </Link>
        </div>
      </div>

      {/* ── 4 STAT METRICS CARDS ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Total Filters */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-sm hover:border-neutral-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400">إجمالي المواد بالكتالوج</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{totalFilters}</span>
            <span className="text-xs text-blue-400 font-bold">مادة مسجلة</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">معروضة للزوار في الكتالوج العام</p>
        </div>

        {/* Card 2: Categories Count */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-sm hover:border-neutral-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400">أقسام وتصنيفات المواد</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{categoriesList.length}</span>
            <span className="text-xs text-emerald-400 font-bold">أقسام رئيسية</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">دهن، هواء، وقود، مجفف، وكابينة</p>
        </div>

        {/* Card 3: Manufacturer breakdown */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-sm hover:border-neutral-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400">الشركات المصنعة</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">2</span>
            <span className="text-xs text-amber-400 font-bold">فئات تصنيع</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">مان فلتـر ومنتجون آخرون</p>
        </div>

        {/* Card 4: FAQs */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-sm hover:border-neutral-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400">الأسئلة الشائعة المنشورة</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{faqCount}</span>
            <span className="text-xs text-purple-400 font-bold">أسئلة نشطة</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">تعديل وإضافة ديناميكية</p>
        </div>

      </div>

      {/* ── 2-COLUMN SECTION: CATEGORY DISTRIBUTION + NAVIGATION ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Category Breakdown (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-sm text-white">توزيع الكتالوج حسب الأقسام</h3>
            <span className="text-xs text-neutral-400 font-mono">100% مطابقة OEM</span>
          </div>

          <div className="space-y-4">
            {categoryStats.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-neutral-300">{item.label}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-neutral-400">{item.count} مادة</span>
                    <span className="text-blue-400 font-bold">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-500`}
                    style={{ width: `${Math.max(5, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Management Widget (1 Col) */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-sm text-white mb-2">أقسام اللوحة السريعة</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-medium">
              الوصول المباشر إلى مخزون المواد، الأسئلة الشائعة، وإعدادات النظام.
            </p>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/admin/items"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-white transition border border-neutral-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>تبويب 2: مخزون المواد والفلاتر</span>
              </div>
              <span className="text-neutral-400">←</span>
            </Link>

            <Link
              href="/admin/faq"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-white transition border border-neutral-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>تبويب 3: الأسئلة الشائعة (FAQ)</span>
              </div>
              <span className="text-neutral-400">←</span>
            </Link>

            <Link
              href="/admin/settings"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-white transition border border-neutral-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>تبويب 4: إعدادات النظام</span>
              </div>
              <span className="text-neutral-400">←</span>
            </Link>
          </div>
        </div>

      </div>

      {/* ── TABLE: RECENT ITEMS IN CATALOG ────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">معاينة مواد الكتالوج</h3>
            <p className="text-xs text-neutral-400 mt-0.5">أحدث المواد المسجلة</p>
          </div>
          <Link
            href="/admin/items"
            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition"
          >
            عرض الكل في المخزون ({products.length}) ←
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-semibold">
              <tr>
                <th className="p-4">الصورة</th>
                <th className="p-4">كود أو اسم المادة</th>
                <th className="p-4">القسم</th>
                <th className="p-4">الشركة المصنعة</th>
                <th className="p-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80 text-neutral-300">
              {products.slice(0, 6).map((item) => {
                const partNumber = item.part_number || item.title || "AL-ANI";
                const isMann = (item.description || "").includes("Mann") || (item.title || "").includes("Mann");
                return (
                  <tr key={item.id} className="hover:bg-neutral-900/40 transition">
                    <td className="p-4">
                      <div className="w-11 h-11 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-center p-1">
                        <Image
                          src={item.image_url || "/products/oil-filter.svg"}
                          alt={item.title}
                          width={44}
                          height={44}
                          className="max-h-9 w-auto object-contain"
                        />
                      </div>
                    </td>
                    <td className="p-4 font-mono font-black text-sm text-white">
                      {partNumber}
                    </td>
                    <td className="p-4">
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[11px] px-2.5 py-1 rounded-lg">
                        {item.clean_type || item.type || "فلتر أصلي"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        isMann
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-neutral-900 text-neutral-300 border-neutral-800"
                      }`}>
                        {isMann ? "مان فلتـر (Mann)" : "منتجون آخرون"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Link
                        href="/admin/items"
                        className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold rounded-lg transition border border-neutral-800"
                      >
                        تعديل
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
