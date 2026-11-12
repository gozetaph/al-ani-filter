"use client";

import { useState, useEffect } from "react";
import { formatIQD } from "@/lib/utils";
import { Order } from "@/lib/types";
import { sampleOrders } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [selectedWaybill, setSelectedWaybill] = useState<Order | null>(null);

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
        // Fallback
      }
    }
    loadOrders();
  }, [supabase]);

  const updateOrderStatus = async (id: string, newStatus: Order["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );

    try {
      await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">
          إدارة الطلبيات والشحن
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          طباعة بوليصة التوصيل (AWB) وإشعار السائق والزبون عبر واتساب
        </p>
      </div>

      {/* Orders Table */}
      <div className="bg-[#1a1d27] border border-white/8 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">
            الطلبيات النشطة ({orders.length})
          </h3>
          <span className="text-xs text-zinc-600">الدفع نقداً عند الاستلام</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-white/8 text-zinc-500 font-semibold">
              <tr>
                <th className="p-3.5">الكود</th>
                <th className="p-3.5">الزبون والهاتف</th>
                <th className="p-3.5 hidden sm:table-cell">المحافظة والعنوان</th>
                <th className="p-3.5 hidden md:table-cell">المواد المطلوبة</th>
                <th className="p-3.5">المطلوب نقداً</th>
                <th className="p-3.5">حالة الطلب</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-white/4 transition">
                  <td className="p-3.5 font-bold font-mono text-white">#{ord.id}</td>
                  
                  <td className="p-3.5">
                    <span className="font-bold text-white block">{ord.customer_name}</span>
                    <span className="text-[11px] text-zinc-500 font-mono" dir="ltr">
                      {ord.phone}
                    </span>
                  </td>

                  <td className="p-3.5 hidden sm:table-cell">
                    <span className="bg-blue-500/15 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20">
                      {ord.governorate}
                    </span>
                    <p className="text-zinc-500 text-[11px] mt-0.5 max-w-xs truncate">
                      {ord.detailed_address}
                    </p>
                  </td>

                  <td className="p-3.5 text-zinc-500 max-w-xs hidden md:table-cell">{ord.notes}</td>

                  <td className="p-3.5">
                    <span className="font-extrabold text-blue-400 text-xs sm:text-sm font-mono">
                      {formatIQD(ord.total_amount)}
                    </span>
                    <span className="text-[10px] text-emerald-500 block font-semibold">
                      نقد عند الباب
                    </span>
                  </td>

                  <td className="p-3.5">
                    <select
                      value={ord.status}
                      onChange={(e) => updateOrderStatus(ord.id, e.target.value as Order["status"])}
                      className="bg-white/6 border border-white/10 rounded-lg p-1.5 text-[11px] font-semibold text-zinc-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="pending">قيد التجهيز</option>
                      <option value="dispatched">مع المندوب</option>
                      <option value="delivered">تم التسليم</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </td>

                  <td className="p-3.5 text-center">
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        onClick={() => setSelectedWaybill(ord)}
                        className="bg-white/10 hover:bg-white/16 text-zinc-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        🖨️ AWB
                      </button>

                      <a
                        href={`https://wa.me/${ord.phone.replace(/[^0-9]/g, "").replace(/^0/, "964")}?text=${encodeURIComponent(
                          `مرحباً ${ord.customer_name}،\n` +
                          `طردك رقم [${ord.id}] من محل العاني للفلتر تم تسليمه للمندوب 🚗\n` +
                          `📍 الوجهة: ${ord.governorate}\n` +
                          `💵 المبلغ: ${formatIQD(ord.total_amount)}\n` +
                          `شكراً لاختيارك العاني للفلتر!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-blue-500/20 transition"
                      >
                        إشعار الزبون 💬
                      </a>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `🚚 إرسال طرد - العاني للفلتر\n` +
                          `📦 كود: ${ord.id}\n` +
                          `👤 المستلم: ${ord.customer_name}\n` +
                          `📱 هاتف: ${ord.phone}\n` +
                          `📍 المحافظة: ${ord.governorate}\n` +
                          `🏠 العنوان: ${ord.detailed_address}\n` +
                          `📋 المحتويات: ${ord.notes}\n` +
                          `💵 المبلغ: ${formatIQD(ord.total_amount)}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-500/20 transition"
                      >
                        للسائق 🚗
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE AWB MODAL */}
      {selectedWaybill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <span className="text-sm font-bold text-white">بوليصة الشحن (AWB)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#004bb5] hover:bg-[#1a5fc8] text-white text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                >
                  طباعة
                </button>
                <button
                  onClick={() => setSelectedWaybill(null)}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/14 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable waybill — white card for print */}
            <div id="printArea" className="m-4 p-5 border-2 border-dashed border-white/20 rounded-xl bg-white text-black print:border-black">
              <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                <div>
                  <h2 className="text-base font-black text-black">العاني للفلتر • AL ANI Filter</h2>
                  <p className="text-[10px] text-gray-500 font-mono">BAGHDAD, IRAQ</p>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-gray-400 block font-mono">TRACKING</span>
                  <span className="text-base font-black font-mono text-black">#{selectedWaybill.id}</span>
                </div>
              </div>

              <div className="bg-gray-100 py-1.5 px-3 rounded text-center mb-3">
                <div className="font-mono text-xs text-gray-400">||| | ||||| |||| || |||||| | |||| |||</div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-gray-700">
                  {selectedWaybill.id}-IRQ-COD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border border-gray-200 rounded-lg p-2.5 mb-3">
                <div>
                  <span className="text-gray-400 block text-[10px] mb-0.5">المستلم:</span>
                  <p className="font-bold text-black">{selectedWaybill.customer_name}</p>
                  <p className="text-gray-600 font-mono mt-0.5" dir="ltr">{selectedWaybill.phone}</p>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] mb-0.5">المحافظة:</span>
                  <p className="font-bold text-black">{selectedWaybill.governorate}</p>
                  <p className="text-gray-600 mt-0.5 truncate">{selectedWaybill.detailed_address}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-2.5 text-xs mb-3">
                <span className="text-[10px] font-bold text-gray-400 block mb-1">محتويات الطرد:</span>
                <p className="font-medium text-black">{selectedWaybill.notes}</p>
              </div>

              <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl text-center">
                <span className="text-[11px] font-bold text-amber-900 uppercase block">
                  المبلغ المطلوب نقداً
                </span>
                <p className="text-2xl font-black text-amber-700 mt-0.5">
                  {formatIQD(selectedWaybill.total_amount)}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
