"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Plus, Search, Users, BadgeCheck, Clock3, X, ExternalLink } from "lucide-react";

type LeadStatus = "new" | "contacted" | "won" | "lost";
type Lead = {
  id: string; customer_name: string; phone: string; interest: string;
  status: LeadStatus; deal_amount: number | null; notes: string; created_at: string;
};
type CatalogOrder = { id: string; customer_name: string; phone: string; total_amount: number; status: string; created_at: string };

const LEADS_KEY = "al_ani_whatsapp_leads";
const statuses: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "جديد" }, { value: "contacted", label: "تم التواصل" },
  { value: "won", label: "صفقة مكتملة" }, { value: "lost", label: "غير مكتملة" },
];
const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-emerald-400/50";
const cardClass = "rounded-2xl border border-white/[0.08] bg-[#0b0d0e]";

export default function AdminDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", phone: "", interest: "", notes: "" });
  const supabase = createClient();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      if (Array.isArray(saved)) setLeads(saved);
    } catch { /* ignore malformed local cache */ }
    let active = true;
    (async () => {
      const { data: orderRows } = await supabase.from("orders").select("id, customer_name, phone, total_amount, status, created_at").order("created_at", { ascending: false }).limit(30);
      if (!active) return;
      if (orderRows) setOrders(orderRows as CatalogOrder[]);
    })();
    return () => { active = false; };
  }, [supabase]);

  const persist = (next: Lead[]) => {
    setLeads(next);
    try { localStorage.setItem(LEADS_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  };
  const addLead = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    const lead: Lead = { id: crypto.randomUUID(), ...form, status: "new", deal_amount: null, created_at: new Date().toISOString() };
    const next = [lead, ...leads]; persist(next); setForm({ customer_name: "", phone: "", interest: "", notes: "" }); setShowForm(false);
    setSaving(false);
  };
  const updateLead = async (lead: Lead, patch: Partial<Lead>) => {
    const updated = { ...lead, ...patch };
    persist(leads.map((item) => item.id === lead.id ? updated : item));
  };
  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const term = search.trim().toLowerCase();
    return (filter === "all" || lead.status === filter) && (!term || `${lead.customer_name} ${lead.phone} ${lead.interest}`.toLowerCase().includes(term));
  }), [leads, search, filter]);
  const won = leads.filter((lead) => lead.status === "won");
  const revenue = won.reduce((sum, lead) => sum + Number(lead.deal_amount || 0), 0);
  const money = (amount: number) => `${amount.toLocaleString("ar-IQ")} د.ع`;
  const whatsAppUrl = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const international = digits.startsWith("0") ? `964${digits.slice(1)}` : digits;
    return `https://wa.me/${international}`;
  };

  return <div className="mx-auto max-w-7xl space-y-7 text-right" dir="rtl">
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-[#111a18] via-[#0b0e0e] to-[#0a0b0c] p-6 sm:p-9">
      <div className="pointer-events-none absolute -left-12 -top-24 h-64 w-64 rounded-full bg-emerald-400/[0.07] blur-3xl" />
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><span className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>إدارة علاقات العملاء</span>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">محادثات واتساب والصفقات</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-neutral-400">سجّل العملاء الذين تواصلوا عبر واتساب، تابع حالة كل محادثة، وسجّل قيمة الصفقة عند إتمامها.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07100c] transition hover:bg-emerald-300"><Plus size={17}/> تسجيل محادثة جديدة</button>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "إجمالي العملاء المسجلين", value: leads.length.toLocaleString("ar-IQ"), icon: Users, accent: "text-sky-300" },
        { label: "بانتظار المتابعة", value: leads.filter((l) => l.status === "new" || l.status === "contacted").length.toLocaleString("ar-IQ"), icon: Clock3, accent: "text-amber-300" },
        { label: "الصفقات المكتملة", value: won.length.toLocaleString("ar-IQ"), icon: BadgeCheck, accent: "text-emerald-300" },
        { label: "إجمالي قيمة الصفقات", value: money(revenue), icon: MessageCircle, accent: "text-violet-300" },
      ].map(({ label, value, icon: Icon, accent }) => <div key={label} className={`${cardClass} p-5`}><div className="flex items-center justify-between"><span className="text-xs text-neutral-400">{label}</span><Icon size={17} className={accent}/></div><p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p></div>)}
    </section>

    <section className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-white">سجل العملاء</h2><p className="mt-1 text-xs text-neutral-500">افتح واتساب من الرقم، ثم حدّث الحالة بعد متابعة المحادثة.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم" className={`${inputClass} py-2.5 pr-9 sm:w-56`}/></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | LeadStatus)} className={`${inputClass} py-2.5 sm:w-44`}><option value="all">كل الحالات</option>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </div>
      </div>
      {visibleLeads.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-white/[0.025] text-xs text-neutral-500"><tr><th className="px-5 py-3 font-medium">العميل</th><th className="px-5 py-3 font-medium">الاستفسار</th><th className="px-5 py-3 font-medium">تاريخ التواصل</th><th className="px-5 py-3 font-medium">حالة الصفقة</th><th className="px-5 py-3 font-medium">قيمة الصفقة</th><th className="px-5 py-3 font-medium">واتساب</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{visibleLeads.map((lead) => <tr key={lead.id} className="transition hover:bg-white/[0.02]"><td className="px-5 py-4"><p className="font-semibold text-white">{lead.customer_name}</p><p className="mt-1 font-mono text-xs text-neutral-500" dir="ltr">{lead.phone}</p></td><td className="max-w-56 px-5 py-4 text-neutral-300">{lead.interest || "استفسار عام"}{lead.notes && <p className="mt-1 truncate text-xs text-neutral-500">{lead.notes}</p>}</td><td className="px-5 py-4 text-xs text-neutral-400">{new Date(lead.created_at).toLocaleDateString("ar-IQ")}</td><td className="px-5 py-4"><select aria-label={`حالة ${lead.customer_name}`} value={lead.status} onChange={(e) => updateLead(lead, { status: e.target.value as LeadStatus })} className="rounded-lg border border-white/10 bg-[#111415] px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-400/50">{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></td><td className="px-5 py-4">{lead.status === "won" ? <input aria-label="قيمة الصفقة بالدينار" type="number" min="0" value={lead.deal_amount ?? ""} onChange={(e) => updateLead(lead, { deal_amount: e.target.value ? Number(e.target.value) : null })} placeholder="المبلغ بالدينار" className="w-36 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-400/50"/> : <span className="text-neutral-600">—</span>}</td><td className="px-5 py-4"><a target="_blank" rel="noreferrer" href={whatsAppUrl(lead.phone)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/15"><MessageCircle size={14}/> مراسلة</a></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-neutral-500"><Users size={19}/></div><h3 className="mt-4 text-sm font-semibold text-neutral-200">لا توجد محادثات مسجلة</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-neutral-500">بعد أن يراسلك العميل عبر واتساب، أضف اسمه ورقمه هنا لتتمكن من متابعته وتوثيق نتيجة البيع.</p><button onClick={() => setShowForm(true)} className="mt-4 text-xs font-semibold text-emerald-300 hover:text-emerald-200">+ تسجيل أول محادثة</button></div>}
    </section>

    <section className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="font-semibold text-white">طلبات الكتالوج</h2><p className="mt-1 text-xs text-neutral-500">الطلبات التي أرسلها العملاء من الموقع، مع قيمتها وحالتها.</p></div><span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-neutral-400">{orders.length} طلب</span></div>
      {orders.length ? <div className="divide-y divide-white/[0.06]">{orders.slice(0, 6).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium text-white">{order.customer_name}<span className="mr-2 font-mono text-xs text-neutral-500">#{order.id}</span></p><p className="mt-1 text-xs text-neutral-500">{order.phone} · {new Date(order.created_at).toLocaleDateString("ar-IQ")}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-neutral-200">{money(order.total_amount || 0)}</span><span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-neutral-400">{order.status}</span><a aria-label="فتح واتساب" target="_blank" rel="noreferrer" href={whatsAppUrl(order.phone)} className="text-emerald-300"><ExternalLink size={15}/></a></div></div>)}</div> : <p className="p-6 text-center text-xs text-neutral-500">لا توجد طلبات كتالوج بعد.</p>}
    </section>

    {showForm && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}><form onSubmit={addLead} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1010] shadow-2xl"><div className="flex items-center justify-between border-b border-white/[0.08] p-5"><div><h2 className="font-semibold text-white">تسجيل محادثة واتساب</h2><p className="mt-1 text-xs text-neutral-500">أدخل معلومات العميل بعد وصول رسالته.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-white/5 hover:text-white"><X size={17}/></button></div><div className="space-y-4 p-5"><label className="block text-xs font-medium text-neutral-300">اسم العميل<input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="الاسم الكامل" className={`${inputClass} mt-2`}/></label><label className="block text-xs font-medium text-neutral-300">رقم واتساب<input required type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9647XXXXXXXXX" className={`${inputClass} mt-2 text-left`}/></label><label className="block text-xs font-medium text-neutral-300">القطعة أو موضوع الاستفسار<input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="رقم القطعة، نوع الفلتر، أو حاجة العميل" className={`${inputClass} mt-2`}/></label><label className="block text-xs font-medium text-neutral-300">ملاحظات<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="تفاصيل تساعدك عند المتابعة" className={`${inputClass} mt-2 resize-y`}/></label></div><div className="flex justify-end gap-2 border-t border-white/[0.08] p-5"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-400 hover:bg-white/5">إلغاء</button><button disabled={saving} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#07100c] hover:bg-emerald-300 disabled:opacity-50">{saving ? "جارٍ الحفظ…" : "حفظ العميل"}</button></div></form></div>}
  </div>;
}
