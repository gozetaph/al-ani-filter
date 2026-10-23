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
    <div className="space-y-6">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          إدارة طلبيات الشحن والتوصيل
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          طباعة بوليصة التوصيل (AWB) وإرسال تفاصيل الطرد مباشرة بالواتساب لسائق التوصيل
        </p>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            الطلبيات النشطة ({orders.length} طلبية)
          </h3>
          <span className="text-xs text-slate-400">الدفع نقداً عند الاستلام (COD)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">الكود</th>
                <th className="p-3.5">الزبون والهاتف</th>
                <th className="p-3.5">المحافظة والعنوان</th>
                <th className="p-3.5">المواد المطلوبة</th>
                <th className="p-3.5">المطلوب نقداً (COD)</th>
                <th className="p-3.5">حالة الطلب</th>
                <th className="p-3.5 text-center">إجراءات الشحن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5 font-bold font-mono text-slate-900">#{ord.id}</td>
                  
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{ord.customer_name}</span>
                    <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                      {ord.phone}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <span className="bg-blue-50 text-[#004bb5] text-[10px] font-bold px-2 py-0.5 rounded">
                      {ord.governorate}
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5 max-w-xs truncate">
                      {ord.detailed_address}
                    </p>
                  </td>

                  <td className="p-3.5 text-slate-600 max-w-xs">{ord.notes}</td>

                  <td className="p-3.5">
                    <span className="font-extrabold text-[#004bb5] text-xs sm:text-sm">
                      {formatIQD(ord.total_amount)}
                    </span>
                    <span className="text-[10px] text-emerald-600 block font-semibold">
                      نقد عند الباب
                    </span>
                  </td>

                  <td className="p-3.5">
                    <select
                      value={ord.status}
                      onChange={(e) => updateOrderStatus(ord.id, e.target.value as any)}
                      className="bg-slate-50 border border-slate-300 rounded-lg p-1 text-[11px] font-semibold text-slate-800"
                    >
                      <option value="pending">قيد التجهيز</option>
                      <option value="dispatched">مع المندوب</option>
                      <option value="delivered">تم التسليم</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </td>

                  <td className="p-3.5 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedWaybill(ord)}
                        className="bg-slate-900 hover:bg-black text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xs transition"
                      >
                        🖨️ بوليصة AWB
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `*طلب توصيل - العاني للفلتر*\n` +
                          `رقم الطلب: #${ord.id}\n` +
                          `اسم الزبون: ${ord.customer_name}\n` +
                          `الهاتف: ${ord.phone}\n` +
                          `المحافظة: ${ord.governorate}\n` +
                          `العنوان: ${ord.detailed_address}\n` +
                          `المواد: ${ord.notes}\n` +
                          `*المبلغ المطلوب تحصيله (COD): ${formatIQD(ord.total_amount)}*`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xs transition"
                      >
                        💬 واتساب
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE AIR WAYBILL MODAL */}
      {selectedWaybill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">بوليصة الشحن الرسمية للمندوب (AWB)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#004bb5] hover:bg-[#00388a] text-white text-xs px-3.5 py-1.5 rounded-lg font-bold shadow-xs"
                >
                  طباعة البوليصة
                </button>
                <button
                  onClick={() => setSelectedWaybill(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Air Waybill Label */}
            <div id="printArea" className="p-6 space-y-4 m-4 border-2 border-dashed border-slate-300 rounded-xl bg-white">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">العاني للفلتر • AL ANI Filter</h2>
                  <p className="text-[10px] text-slate-500 font-mono">BAGHDAD, IRAQ • SHIPMENT MANIFEST</p>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block font-mono">TRACKING CODE</span>
                  <span className="text-base font-black font-mono text-slate-900">#{selectedWaybill.id}</span>
                </div>
              </div>

              {/* Barcode representation */}
              <div className="bg-slate-100 py-1.5 px-3 rounded text-center">
                <div className="font-mono text-xs text-slate-400 tracking-wider">||| | ||||| |||| || |||||| | |||| |||</div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-700">
                  {selectedWaybill.id}-IRQ-COD
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border border-slate-200 rounded-lg p-2.5">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">اسم المستلم:</span>
                  <p className="font-bold text-slate-900">{selectedWaybill.customer_name}</p>
                  <p className="text-slate-600 font-mono mt-0.5" dir="ltr">{selectedWaybill.phone}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">المحافظة والعنوان:</span>
                  <p className="font-bold text-slate-900">{selectedWaybill.governorate}</p>
                  <p className="text-slate-600 mt-0.5 truncate">{selectedWaybill.detailed_address}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-2.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">المحتويات في الطرد:</span>
                <p className="font-medium text-slate-800">{selectedWaybill.notes}</p>
              </div>

              <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl text-center">
                <span className="text-[11px] font-bold text-amber-900 uppercase block">
                  المبلغ المطلوب تحصيله نقداً من الزبون (COD)
                </span>
                <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-0.5">
                  {formatIQD(selectedWaybill.total_amount)}
                </p>
                <span className="text-[10px] text-amber-800 block mt-0.5">(شامل ثمن البضاعة + أجور التوصيل)</span>
              </div>

              <div className="text-[10px] text-slate-400 text-center border-t border-slate-200 pt-2">
                شكراً لتعاملكم مع العاني للفلتر • يرجى عدم فتح الطرد إلا بحضور مندوب شركة التوصيل
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
