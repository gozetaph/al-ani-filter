"use client";

import { useState, useEffect } from "react";
import { FAQItem } from "@/lib/types";
import { initialFaqs } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>(initialFaqs);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  
  // Form State
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpenIdx, setPreviewOpenIdx] = useState<number | null>(0);

  const supabase = createClient();

  useEffect(() => {
    async function loadFaqs() {
      // 1. Local storage check
      const cached = localStorage.getItem("al_ani_faqs");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setFaqs(parsed);
        } catch {
          // ignore
        }
      }

      // 2. Query Supabase
      try {
        const { data, error } = await supabase
          .from("faqs")
          .select("*")
          .order("order_index", { ascending: true });

        if (!error && data && data.length > 0) {
          setFaqs(data);
          localStorage.setItem("al_ani_faqs", JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Supabase faqs query fallback:", err);
      }
    }
    loadFaqs();
  }, [supabase]);

  const syncStorage = (updated: FAQItem[]) => {
    setFaqs(updated);
    try {
      localStorage.setItem("al_ani_faqs", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleOpenAdd = () => {
    setEditingFaq(null);
    setQuestion("");
    setAnswer("");
    setIsActive(true);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (faq: FAQItem) => {
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setIsActive(faq.is_active !== false);
    setIsAddModalOpen(true);
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    setIsSaving(true);

    if (editingFaq) {
      const updatedItem: FAQItem = {
        ...editingFaq,
        question: question.trim(),
        answer: answer.trim(),
        is_active: isActive,
      };

      const updatedList = faqs.map((f) => (f.id === editingFaq.id ? updatedItem : f));
      syncStorage(updatedList);

      try {
        await supabase
          .from("faqs")
          .update({
            question: updatedItem.question,
            answer: updatedItem.answer,
            is_active: updatedItem.is_active,
          })
          .eq("id", editingFaq.id);
      } catch (err) {
        console.warn("DB update fallback:", err);
      }
    } else {
      const newItem: FAQItem = {
        id: "faq-" + Date.now(),
        question: question.trim(),
        answer: answer.trim(),
        order_index: faqs.length + 1,
        is_active: isActive,
        created_at: new Date().toISOString(),
      };

      const updatedList = [...faqs, newItem];
      syncStorage(updatedList);

      try {
        await supabase.from("faqs").insert([
          {
            id: newItem.id,
            question: newItem.question,
            answer: newItem.answer,
            order_index: newItem.order_index,
            is_active: newItem.is_active,
          },
        ]);
      } catch (err) {
        console.warn("DB insert fallback:", err);
      }
    }

    setIsSaving(false);
    setIsAddModalOpen(false);
  };

  const handleToggleActive = async (id: string) => {
    const target = faqs.find((f) => f.id === id);
    if (!target) return;
    const nextState = !(target.is_active !== false);

    const updated = faqs.map((f) =>
      f.id === id ? { ...f, is_active: nextState } : f
    );
    syncStorage(updated);

    try {
      await supabase.from("faqs").update({ is_active: nextState }).eq("id", id);
    } catch {
      // ignore
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;

    const copy = [...faqs];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const reordered = copy.map((item, idx) => ({
      ...item,
      order_index: idx + 1,
    }));

    syncStorage(reordered);
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا السؤال نهائياً؟")) return;

    const updated = faqs.filter((f) => f.id !== id);
    syncStorage(updated);

    try {
      await supabase.from("faqs").delete().eq("id", id);
    } catch (err) {
      console.warn("DB delete fallback:", err);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      
      {/* ── TOP HEADER BAR ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            إدارة الأسئلة الشائعة (FAQ)
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-semibold">
            تعديل النصوص، إضافة أسئلة جديدة، وحذف الأسئلة بشكل ديناميكي ومباشر
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <span>+ إضافة سؤال جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* FAQ List Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">
                قائمة الأسئلة ({faqs.length})
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">
                {faqs.filter((f) => f.is_active !== false).length} ظاهر في الكتالوج
              </span>
            </div>

            {faqs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-xs text-neutral-500">لا توجد أسئلة حالياً.</p>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  إضافة أول سؤال
                </button>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80">
                {faqs.map((faq, idx) => (
                  <div key={faq.id} className="p-4 sm:p-5 hover:bg-neutral-900/40 transition space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-neutral-900 text-neutral-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-neutral-800">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white leading-snug">
                            {faq.question}
                          </h4>
                          <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                            {faq.answer}
                          </p>
                        </div>
                      </div>

                      {/* Status toggle button */}
                      <button
                        onClick={() => handleToggleActive(faq.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border transition cursor-pointer ${
                          faq.is_active !== false
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-neutral-900 text-neutral-500 border-neutral-800"
                        }`}
                      >
                        {faq.is_active !== false ? "● مفعل" : "○ معطل"}
                      </button>
                    </div>

                    {/* Actions bar */}
                    <div className="pt-2.5 flex items-center justify-between border-t border-neutral-800/80 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleMove(idx, "up")}
                          disabled={idx === 0}
                          className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 rounded-lg text-[11px] font-bold text-neutral-300 transition cursor-pointer border border-neutral-800"
                        >
                          ↑ أعلى
                        </button>
                        <button
                          onClick={() => handleMove(idx, "down")}
                          disabled={idx === faqs.length - 1}
                          className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 rounded-lg text-[11px] font-bold text-neutral-300 transition cursor-pointer border border-neutral-800"
                        >
                          ↓ أسفل
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(faq)}
                          className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-blue-400 font-bold rounded-lg transition border border-neutral-800 cursor-pointer text-xs"
                        >
                          تعديل النص
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg transition border border-rose-500/20 cursor-pointer text-xs"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Panel (5 cols) */}
        <div className="lg:col-span-5 sticky top-20">
          <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="font-bold text-xs text-white">معاينة شكل الأسئلة في الموقع</span>
              <span className="text-[10px] text-neutral-400 font-mono">Live Preview</span>
            </div>

            <div className="bg-white text-neutral-900 p-4 rounded-xl space-y-2 border border-neutral-300 shadow-inner">
              <h4 className="font-extrabold text-xs text-center text-black mb-3">الأسئلة الشائعة</h4>
              <div className="divide-y divide-neutral-200">
                {faqs
                  .filter((f) => f.is_active !== false)
                  .map((f, i) => {
                    const isOpen = previewOpenIdx === i;
                    return (
                      <div key={f.id} className="py-2.5">
                        <button
                          type="button"
                          onClick={() => setPreviewOpenIdx(isOpen ? null : i)}
                          className="w-full flex items-center justify-between text-right text-xs font-bold text-black gap-2 cursor-pointer"
                        >
                          <span>{f.question}</span>
                          <span className="font-mono text-sm text-neutral-500">{isOpen ? "−" : "+"}</span>
                        </button>
                        {isOpen && (
                          <p className="mt-1.5 text-[11px] text-neutral-600 leading-relaxed pr-2 font-medium">
                            {f.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── ADD / EDIT FAQ MODAL ─────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-scaleUp">
            
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">
                {editingFaq ? "تعديل نص السؤال" : "إضافة سؤال جديد"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white font-bold cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="p-5 space-y-4 text-xs" dir="rtl">
              
              <div>
                <label className="block font-bold text-neutral-300 mb-1">نص السؤال *</label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="مثال: كيف أتأكد من مطابقة كود الفلتر لمحرك سيارتي؟"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-300 mb-1">نص الإجابة *</label>
                <textarea
                  rows={4}
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="اكتب الإجابة المفصلة..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition leading-relaxed font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="faqActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="faqActive" className="font-semibold text-neutral-300 cursor-pointer">
                  تفعيل السؤال وعرضه فوراً في الكتالوج الرئيسي
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:bg-neutral-900 font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "جاري الحفظ..." : editingFaq ? "حفظ التعديل" : "إضافة السؤال"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
