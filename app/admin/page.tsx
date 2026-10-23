"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/utils";
import { Order } from "@/lib/types";
import { sampleOrders } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month" | "all">("month");

  const supabase = createClient();

  useEffect(() => {
    async function loadOrders() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setOrders(data);
        }
      } catch {
        // Fallback to sample data
      }
    }
    loadOrders();
  }, [supabase]);

  // Filter orders by time period
  const now = new Date();
  const filteredOrders = orders.filter((order) => {
    if (timePeriod === "all") return true;
    const orderDate = new Date(order.created_at || Date.now());

    if (timePeriod === "today") {
      return (
        orderDate.getDate() === now.getDate() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    if (timePeriod === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return orderDate >= oneWeekAgo;
    }

    if (timePeriod === "month") {
      return (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });

  // Calculate This Month Sales
  const thisMonthSales = orders
    .filter((o) => {
      const d = new Date(o.created_at || Date.now());
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Period Metrics
  const periodTotalSales = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const periodOrderCount = filteredOrders.length;
  const avgOrderValue = periodOrderCount > 0 ? Math.round(periodTotalSales / periodOrderCount) : 0;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            لوحة الإحصائيات وتحليل المبيعات
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة دقيقة للأرباح والطلبيات الواردة خلال الفترات الزمنية المختلفة
          </p>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-300">
          {[
            { key: "today", label: "اليوم" },
            { key: "week", label: "هذا الأسبوع" },
            { key: "month", label: "هذا الشهر" },
            { key: "all", label: "جميع الفترات" },
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => setTimePeriod(period.key as any)}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                timePeriod === period.key
                  ? "bg-white text-[#004bb5] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales This Month (Explicit requirement) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-blue-200 shadow-xs relative overflow-hidden">
          <div className="w-1.5 h-full bg-[#004bb5] absolute right-0 top-0"></div>
          <span className="text-xs font-bold text-slate-500 block mb-1">
            مبيعات هذا الشهر (المؤكدة)
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-[#004bb5]">
            {formatIQD(thisMonthSales)}
          </h3>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            ✓ تحديث تلقائي للمدفوعات نقد عند الباب
          </span>
        </div>

        {/* Selected Period Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            المبيعات للفترة المختارة
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            {formatIQD(periodTotalSales)}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            {timePeriod === "today" ? "طلبات اليوم فقط" : (timePeriod === "week" ? "خلال آخر 7 أيام" : "المجموع التراكمي")}
          </span>
        </div>

        {/* Order Count in Period */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            عدد الطلبيات المكتملة
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            {periodOrderCount} طلبات
          </h3>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
            جاهزة للتجهيز والشحن
          </span>
        </div>

        {/* Average Order Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            متوسط قيمة الطلب الواحد
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            {formatIQD(avgOrderValue)}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            معدل الصرف للزبون العراقي
          </span>
        </div>

      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/items"
          className="bg-white hover:bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between group transition"
        >
          <div>
            <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#004bb5] transition">
              إدارة المخزن والمواد ➔
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              عرض المواد المتوفرة، تعديل الأسعار، وإضافة مادة جديدة بالصورة والوصف
            </p>
          </div>
          <span className="text-2xl">📦</span>
        </Link>

        <Link
          href="/admin/orders"
          className="bg-white hover:bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between group transition"
        >
          <div>
            <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#004bb5] transition">
              قائمة الطلبيات والشحن ➔
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              طباعة بوالص الشحن (AWB)، مراسلة السائقين بالواتساب، وتتبع التسليم
            </p>
          </div>
          <span className="text-2xl">🚚</span>
        </Link>
      </div>

      {/* Recent Orders in Period Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            سجل مبيعات الفترة ({filteredOrders.length} طلبية)
          </h3>
          <Link href="/admin/orders" className="text-xs font-bold text-[#004bb5] hover:underline">
            عرض كافة الطلبيات التفصيلية ➔
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">رقم الطلب</th>
                <th className="p-3">الزبون</th>
                <th className="p-3">المحافظة</th>
                <th className="p-3">المواد</th>
                <th className="p-3">المبلغ الإجمالي (COD)</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا توجد طلبيات مسجلة في هذه الفترة الزمنية
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">#{ord.id}</td>
                    <td className="p-3 font-semibold text-slate-900">{ord.customer_name}</td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        {ord.governorate}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{ord.notes}</td>
                    <td className="p-3 font-extrabold text-[#004bb5]">{formatIQD(ord.total_amount)}</td>
                    <td className="p-3">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {ord.status === "dispatched" ? "مع المندوب" : "قيد التجهيز"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
