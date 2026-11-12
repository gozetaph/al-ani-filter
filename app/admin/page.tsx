"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/utils";
import { Order } from "@/lib/types";
import { sampleOrders } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

// Status config
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  pending:    { label: "قيد التجهيز", color: "text-amber-400",  bg: "bg-amber-400/15 border-amber-400/30",  dot: "bg-amber-400"  },
  confirmed:  { label: "مؤكد",        color: "text-blue-400",   bg: "bg-blue-400/15 border-blue-400/30",    dot: "bg-blue-400"   },
  dispatched: { label: "مع المندوب",  color: "text-violet-400", bg: "bg-violet-400/15 border-violet-400/30", dot: "bg-violet-400" },
  delivered:  { label: "تم التسليم", color: "text-emerald-400", bg: "bg-emerald-400/15 border-emerald-400/30", dot: "bg-emerald-400" },
  cancelled:  { label: "ملغي",       color: "text-rose-400",   bg: "bg-rose-400/15 border-rose-400/30",   dot: "bg-rose-400"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month" | "all">("month");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function loadOrders() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) setOrders(data);
      } catch {
        // fallback to sample data
      }
    }
    loadOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();

  const filteredOrders = orders.filter((order) => {
    // Time filter
    if (timePeriod !== "all") {
      const orderDate = new Date(order.created_at || Date.now());
      if (timePeriod === "today") {
        const isToday =
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (timePeriod === "week") {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        if (orderDate < oneWeekAgo) return false;
      } else if (timePeriod === "month") {
        if (
          orderDate.getMonth() !== now.getMonth() ||
          orderDate.getFullYear() !== now.getFullYear()
        ) return false;
      }
    }
    // Status filter
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    // Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = `${order.id} ${order.customer_name} ${order.governorate} ${order.phone}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const thisMonthSales = orders
    .filter((o) => {
      const d = new Date(o.created_at || Date.now());
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, o) => s + o.total_amount, 0);

  const periodSales = filteredOrders.reduce((s, o) => s + o.total_amount, 0);
  const periodCount = filteredOrders.length;
  const avgValue = periodCount > 0 ? Math.round(periodSales / periodCount) : 0;
  const deliveredCount = filteredOrders.filter((o) => o.status === "delivered").length;

  const kpis = [
    {
      label: "مبيعات الشهر الحالي",
      value: formatIQD(thisMonthSales),
      sub: "مجموع المبيعات المؤكدة",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: "text-blue-400",
      ring: "border-blue-500/20",
    },
    {
      label: "مجموع الفترة المختارة",
      value: formatIQD(periodSales),
      sub: `${periodCount} طلبية`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      accent: "text-violet-400",
      ring: "border-violet-500/20",
    },
    {
      label: "متوسط قيمة الطلب",
      value: formatIQD(avgValue),
      sub: "لكل طلبية",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      accent: "text-emerald-400",
      ring: "border-emerald-500/20",
    },
    {
      label: "طلبيات مسلمة",
      value: `${deliveredCount}`,
      sub: `من ${periodCount} طلبية`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: "text-amber-400",
      ring: "border-amber-500/20",
    },
  ];

  return (
    <div className="space-y-6 text-right" dir="rtl">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">لوحة الإحصائيات</h1>
          <p className="text-xs text-zinc-500 mt-0.5">متابعة المبيعات والطلبيات</p>
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-1 bg-white/6 border border-white/10 rounded-xl p-1 text-xs font-semibold">
          {([
            { key: "today", label: "اليوم" },
            { key: "week",  label: "الأسبوع" },
            { key: "month", label: "الشهر" },
            { key: "all",   label: "الكل" },
          ] as const).map((p) => (
            <button
              key={p.key}
              onClick={() => setTimePeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timePeriod === p.key
                  ? "bg-white/12 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`bg-[#1a1d27] border ${kpi.ring} rounded-2xl p-4 space-y-3`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">{kpi.label}</span>
              <span className={`${kpi.accent} opacity-80`}>{kpi.icon}</span>
            </div>
            <div>
              <p className={`text-xl font-black tracking-tight ${kpi.accent}`}>{kpi.value}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Nav ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/admin/items"
          className="bg-[#1a1d27] hover:bg-[#1f2235] border border-white/8 hover:border-blue-500/30 rounded-2xl p-4 flex items-center justify-between group transition"
        >
          <div>
            <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition">
              إدارة المنتجات والكتالوج
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">إضافة وتعديل الفلاتر وأرقام OEM</p>
          </div>
          <span className="text-zinc-600 group-hover:text-blue-400 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </span>
        </Link>

        <Link
          href="/admin/orders"
          className="bg-[#1a1d27] hover:bg-[#1f2235] border border-white/8 hover:border-violet-500/30 rounded-2xl p-4 flex items-center justify-between group transition"
        >
          <div>
            <h4 className="font-bold text-sm text-white group-hover:text-violet-400 transition">
              إدارة الطلبيات والشحن
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">طباعة AWB وإشعار السائق والزبون</p>
          </div>
          <span className="text-zinc-600 group-hover:text-violet-400 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
        </Link>
      </div>

      {/* ── Orders Table + Detail Panel ─────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Orders Table */}
        <div className={`bg-[#1a1d27] border border-white/8 rounded-2xl overflow-hidden transition-all duration-300 ${selectedOrder ? "flex-1 min-w-0" : "w-full"}`}>
          
          {/* Table toolbar */}
          <div className="p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-white">
              سجل الطلبيات ({filteredOrders.length})
            </h3>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث..."
                  dir="rtl"
                  className="bg-white/6 border border-white/10 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 w-36 transition"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/6 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">قيد التجهيز</option>
                <option value="dispatched">مع المندوب</option>
                <option value="delivered">مسلم</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 text-zinc-500 font-semibold">
                  <th className="p-3.5 text-right">رقم الطلب</th>
                  <th className="p-3.5 text-right">الزبون</th>
                  {!selectedOrder && <th className="p-3.5 text-right hidden sm:table-cell">المحافظة</th>}
                  {!selectedOrder && <th className="p-3.5 text-right hidden md:table-cell">المواد</th>}
                  <th className="p-3.5 text-right">المبلغ</th>
                  <th className="p-3.5 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-zinc-600">
                      لا توجد طلبيات في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const isSelected = selectedOrder?.id === ord.id;
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(isSelected ? null : ord)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-500/10 border-r-2 border-r-blue-500"
                            : "hover:bg-white/4"
                        }`}
                      >
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-zinc-200 text-xs">#{ord.id}</span>
                          <span className="block text-[10px] text-zinc-600 font-normal mt-0.5">
                            {ord.created_at
                              ? new Date(ord.created_at).toLocaleDateString("ar-IQ", { month: "short", day: "numeric" })
                              : "—"}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-zinc-200">{ord.customer_name}</td>
                        {!selectedOrder && (
                          <td className="p-3.5 hidden sm:table-cell">
                            <span className="text-zinc-400 bg-white/6 px-2 py-0.5 rounded text-[11px]">
                              {ord.governorate}
                            </span>
                          </td>
                        )}
                        {!selectedOrder && (
                          <td className="p-3.5 text-zinc-500 max-w-[180px] truncate hidden md:table-cell">
                            {ord.notes}
                          </td>
                        )}
                        <td className="p-3.5 font-extrabold text-blue-400 font-mono">
                          {formatIQD(ord.total_amount)}
                        </td>
                        <td className="p-3.5">
                          <StatusBadge status={ord.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-white/8 text-center">
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
            >
              عرض إدارة الطلبيات الكاملة ←
            </Link>
          </div>
        </div>

        {/* Order Detail Panel */}
        {selectedOrder && (
          <div className="w-72 shrink-0 bg-[#1a1d27] border border-white/8 rounded-2xl overflow-hidden" dir="rtl">
            {/* Panel Header */}
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">طلبية #{selectedOrder.id}</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {selectedOrder.created_at
                    ? new Date(selectedOrder.created_at).toLocaleString("ar-IQ", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/14 flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedOrder.status} />
                <span className="text-[11px] text-zinc-500">الحالة الحالية</span>
              </div>

              {/* Customer */}
              <div className="bg-white/4 rounded-xl p-3 space-y-2">
                <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold block">الزبون</span>
                <p className="font-bold text-sm text-white">{selectedOrder.customer_name}</p>
                <p className="text-xs text-zinc-400 font-mono" dir="ltr">{selectedOrder.phone}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                    {selectedOrder.governorate}
                  </span>
                </div>
                {selectedOrder.detailed_address && (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{selectedOrder.detailed_address}</p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold block">المواد المطلوبة</span>
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {selectedOrder.notes || "—"}
                  </p>
                </div>
              </div>

              {/* Total */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-zinc-400">المجموع الكلي</span>
                <span className="font-black text-lg text-blue-400 font-mono">
                  {formatIQD(selectedOrder.total_amount)}
                </span>
              </div>

              {/* WhatsApp actions */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/${selectedOrder.phone
                    .replace(/[^0-9]/g, "")
                    .replace(/^0/, "964")}?text=${encodeURIComponent(
                    `مرحباً ${selectedOrder.customer_name}، طردك #${selectedOrder.id} في الطريق إليك 🚗\nالمبلغ المطلوب: ${formatIQD(selectedOrder.total_amount)}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 rounded-xl text-[11px] font-semibold transition"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z"/>
                  </svg>
                  إشعار الزبون
                </a>
                <Link
                  href="/admin/orders"
                  className="flex items-center justify-center gap-1.5 py-2 bg-white/6 border border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl text-[11px] font-semibold transition"
                >
                  تفاصيل الشحن
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
