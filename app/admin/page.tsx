"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/utils";
import { Order } from "@/lib/types";
import { sampleOrders } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

// ── Status pill config ────────────────────────────────────────────────────────
type StatusKey = "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled";

const STATUS: Record<StatusKey, { label: string; cls: string }> = {
  pending:    { label: "قيد التجهيز", cls: "bg-amber-500/20  text-amber-300  border-amber-500/30"  },
  confirmed:  { label: "مؤكد",        cls: "bg-blue-500/20   text-blue-300   border-blue-500/30"   },
  dispatched: { label: "مع المندوب",  cls: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  delivered:  { label: "تم التسليم", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  cancelled:  { label: "ملغي",       cls: "bg-rose-500/20   text-rose-300   border-rose-500/30"   },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status as StatusKey] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-pink-500","bg-indigo-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white font-bold text-[11px] shrink-0`}>
      {initials || "?"}
    </div>
  );
}

// ── Format date ───────────────────────────────────────────────────────────────
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function AdminOrdersView() {
  const [orders, setOrders]           = useState<Order[]>(sampleOrders);
  const [selected, setSelected]       = useState<Order | null>(sampleOrders[0] ?? null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch]           = useState("");
  const [checkedIds, setCheckedIds]   = useState<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          setOrders(data);
          setSelected(data[0]);
        }
      } catch { /* fallback */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived list ─────────────────────────────────────────────────────────
  const visible = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${o.id} ${o.customer_name} ${o.governorate} ${o.phone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ── KPIs (compact) ───────────────────────────────────────────────────────
  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const deliveredCount = orders.filter(o => o.status === "delivered").length;

  // ── Checkbox helpers ─────────────────────────────────────────────────────
  const toggleCheck = (id: string) => setCheckedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allChecked = visible.length > 0 && visible.every(o => checkedIds.has(o.id));
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(visible.map(o => o.id)));
  };

  return (
    <div className="flex flex-col h-full gap-5" dir="ltr">

      {/* ── Top KPI strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: "Total Revenue",    value: formatIQD(totalRevenue), sub: `${orders.length} orders`, color: "text-blue-400" },
          { label: "Pending Dispatch", value: String(pendingCount),    sub: "need action",             color: "text-amber-400" },
          { label: "Delivered",        value: String(deliveredCount),  sub: "completed",               color: "text-emerald-400" },
        ].map((k, i) => (
          <div key={i} className="bg-[#1a1d27] border border-white/8 rounded-2xl px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-zinc-500 font-medium">{k.label}</p>
              <p className={`text-lg font-black mt-0.5 ${k.color}`}>{k.value}</p>
            </div>
            <span className="text-[11px] text-zinc-600">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Main 2-col: Table + Detail panel ───────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Orders table ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-[#1a1d27] border border-white/8 rounded-2xl flex flex-col overflow-hidden">

          {/* Table header bar */}
          <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between gap-3 shrink-0">
            <h2 className="font-black text-base text-white">Orders</h2>

            {/* Filters row */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Status chips */}
              {(["all","pending","dispatched","delivered","cancelled"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                    statusFilter === s
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : "bg-white/5 text-zinc-500 border-white/8 hover:text-zinc-300"
                  }`}
                >
                  {s === "all" ? "All" : s === "pending" ? "Pending" : s === "dispatched" ? "Dispatched" : s === "delivered" ? "Delivered" : "Cancelled"}
                </button>
              ))}

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search"
                  className="bg-white/5 border border-white/8 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-28 transition"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1a1d27] border-b border-white/8 z-10">
                <tr className="text-zinc-500 font-semibold">
                  <th className="pl-5 pr-3 py-3 text-left w-8">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                      className="rounded border-white/20 bg-white/5 cursor-pointer accent-blue-500 w-3.5 h-3.5" />
                  </th>
                  <th className="px-3 py-3 text-left">Order #</th>
                  <th className="px-3 py-3 text-left">Customer</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Governorate</th>
                  <th className="px-3 py-3 text-left hidden xl:table-cell">Items</th>
                  <th className="px-3 py-3 text-left">Total</th>
                  <th className="px-3 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visible.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center text-zinc-600">No orders found</td></tr>
                ) : visible.map(ord => {
                  const isActive = selected?.id === ord.id;
                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelected(ord)}
                      className={`cursor-pointer transition-colors ${isActive ? "bg-blue-600/12" : "hover:bg-white/4"}`}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 pr-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={checkedIds.has(ord.id)} onChange={() => toggleCheck(ord.id)}
                          className="rounded border-white/20 bg-white/5 cursor-pointer accent-blue-500 w-3.5 h-3.5" />
                      </td>

                      {/* Order # + date */}
                      <td className="px-3 py-3">
                        <span className="font-mono font-bold text-zinc-200">#{ord.id}</span>
                        <span className="block text-[10px] text-zinc-600 mt-0.5">{fmtDate(ord.created_at)}</span>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={ord.customer_name} size={7} />
                          <span className="font-semibold text-zinc-200 truncate max-w-[120px]">{ord.customer_name}</span>
                        </div>
                      </td>

                      {/* Governorate */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-zinc-400 bg-white/6 border border-white/8 px-2 py-0.5 rounded text-[11px]">{ord.governorate}</span>
                      </td>

                      {/* Items/notes */}
                      <td className="px-3 py-3 hidden xl:table-cell text-zinc-500 max-w-[160px] truncate">{ord.notes || "—"}</td>

                      {/* Total */}
                      <td className="px-3 py-3 font-mono font-extrabold text-zinc-100">{formatIQD(ord.total_amount)}</td>

                      {/* Status */}
                      <td className="px-3 py-3"><StatusPill status={ord.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-zinc-600">{visible.length} orders</span>
            <Link href="/admin/orders" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition">
              Full shipping management →
            </Link>
          </div>
        </div>

        {/* ── Detail panel ─────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-[#1a1d27] border border-white/8 rounded-2xl flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Panel header */}
              <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={selected.status} />
                  </div>
                  <h3 className="font-black text-sm text-white mt-1.5">Order #{selected.id}</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(selected.created_at)}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-6 h-6 rounded-lg bg-white/8 hover:bg-white/14 flex items-center justify-center text-zinc-500 hover:text-white transition cursor-pointer shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Customer card */}
                <div className="bg-white/4 border border-white/8 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Customer</span>
                    <a
                      href={`https://wa.me/${selected.phone.replace(/[^0-9]/g,"").replace(/^0/,"964")}`}
                      target="_blank" rel="noreferrer"
                      className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={selected.customer_name} size={9} />
                    <div>
                      <p className="font-bold text-sm text-white leading-tight">{selected.customer_name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono" dir="ltr">{selected.phone}</p>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-white/8 space-y-1">
                    <span className="inline-block bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                      {selected.governorate}
                    </span>
                    {selected.detailed_address && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{selected.detailed_address}</p>
                    )}
                  </div>
                </div>

                {/* Order items */}
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block mb-2">Order Items</span>
                  <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                    {selected.items && selected.items.length > 0 ? (
                      <div className="space-y-2.5">
                        {selected.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-white/8 rounded-lg flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-zinc-200 truncate">
                                {item.product?.title || `Product ${item.product_id}`}
                              </p>
                              <p className="text-[10px] text-zinc-500">{formatIQD(item.unit_price)} × {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 leading-relaxed">{selected.notes || "—"}</p>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-white/4 border border-white/8 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatIQD(selected.subtotal || selected.total_amount)}</span>
                  </div>
                  {selected.shipping_fee > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Shipping</span>
                      <span className="font-mono">{formatIQD(selected.shipping_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-white border-t border-white/8 pt-2">
                    <span>Total</span>
                    <span className="font-mono text-blue-400">{formatIQD(selected.total_amount)}</span>
                  </div>
                </div>

              </div>

              {/* Action buttons */}
              <div className="p-3 border-t border-white/8 grid grid-cols-2 gap-2 shrink-0">
                <a
                  href={`https://wa.me/${selected.phone.replace(/[^0-9]/g,"").replace(/^0/,"964")}?text=${encodeURIComponent(
                    `مرحباً ${selected.customer_name}، طردك #${selected.id} في الطريق إليك 🚗\nالمبلغ: ${formatIQD(selected.total_amount)}`
                  )}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25 rounded-xl text-[11px] font-semibold transition"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z"/>
                  </svg>
                  Notify
                </a>
                <Link
                  href="/admin/orders"
                  className="flex items-center justify-center gap-1.5 py-2 bg-white/6 border border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl text-[11px] font-semibold transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Dispatch
                </Link>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Select an order
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
