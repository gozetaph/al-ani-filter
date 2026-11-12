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

  // Load FAQs from Supabase or localStorage
  useEffect(() => {
    async function loadFaqs() {
      // 1. Try local storage first for instant response
      const cached = localStorage.getItem("al_ani_faqs");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFaqs(parsed);
          }
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

  // Save to LocalStorage helper
  const syncStorage = (updated: FAQItem[]) => {
    setFaqs(updated);
    try {
      localStorage.setItem("al_ani_faqs", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingFaq(null);
    setQuestion("");
    setAnswer("");
    setIsActive(true);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (faq: FAQItem) => {
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setIsActive(faq.is_active !== false);
    setIsAddModalOpen(true);
  };

  // Save FAQ (Create or Update)
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    setIsSaving(true);

    if (editingFaq) {
      // Updating existing FAQ
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
        console.warn("DB update failed, kept in local state:", err);
      }
    } else {
      // Adding new FAQ
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
        console.warn("DB insert failed, kept in local state:", err);
      }
    }

    setIsSaving(false);
    setIsAddModalOpen(false);
  };

  // Toggle active/hidden
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

  // Move up / down
  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;

    const copy = [...faqs];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    // Reassign order_index
    const reordered = copy.map((item, idx) => ({
      ...item,
      order_index: idx + 1,
    }));

    syncStorage(reordered);
  };

  // Delete FAQ
  const handleDeleteFaq = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا السؤال نهائياً؟")) return;

    const updated = faqs.filter((f) => f.id !== id);
    syncStorage(updated);

    try {
      await supabase.from("faqs").delete().eq("id", id);
    } catch (err) {
      console.warn("DB delete failed:", err);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">
            إدارة الأسئلة الشائعة (FAQ)
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            تحكم في أسئلة وأجوبة الموقع مع معاينة مباشرة
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#004bb5] hover:bg-[#1a5fc8] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          + إضافة سؤال جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* FAQ List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#1a1d27] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">
                قائمة الأسئلة ({faqs.length})
              </h3>
              <span className="text-[11px] text-zinc-600 font-mono">
                {faqs.filter((f) => f.is_active !== false).length} ظاهر
              </span>
            </div>

            {faqs.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-xs text-zinc-600">لا توجد أسئلة حالياً.</p>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-[#004bb5] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  إضافة سؤال
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {faqs.map((faq, idx) => (
                  <div key={faq.id} className="p-4 hover:bg-white/4 transition space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/8 text-zinc-500 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white leading-snug">
                            {faq.question}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleActive(faq.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer ${
                          faq.is_active !== false
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                            : "bg-white/6 text-zinc-500 border-white/10"
                        }`}
                      >
                        {faq.is_active !== false ? "● مفعل" : "○ معطل"}
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-white/5 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMove(idx, "up")}
                          disabled={idx === 0}
                          className="px-2 py-1 bg-white/6 hover:bg-white/10 disabled:opacity-30 rounded text-[11px] font-bold text-zinc-400 cursor-pointer transition"
                        >
                          ↑ أعلى
                        </button>
                        <button
                          onClick={() => handleMove(idx, "down")}
                          disabled={idx === faqs.length - 1}
                          className="px-2 py-1 bg-white/6 hover:bg-white/10 disabled:opacity-30 rounded text-[11px] font-bold text-zinc-400 cursor-pointer transition"
                        >
                          ↓ أسفل
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(faq)}
                          className="px-3 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-bold rounded-lg transition cursor-pointer border border-blue-500/20"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg transition cursor-pointer border border-rose-500/20"
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

        {/* Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#1a1d27] border border-white/8 rounded-2xl p-5 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-4">
              <span className="font-bold text-xs text-zinc-500 uppercase tracking-wider font-mono">
                معاينة حية
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="text-center space-y-1 mb-5">
              <h2 className="text-base font-black text-white">الأسئلة الشائعة</h2>
              <p className="text-[11px] text-zinc-600">كما تظهر للزوار في الموقع</p>
            </div>

            <div className="divide-y divide-white/8 border-y border-white/8">
              {faqs
                .filter((f) => f.is_active !== false)
                .map((item, idx) => {
                  const isOpen = previewOpenIdx === idx;
                  return (
                    <div key={item.id} className="py-3 px-2">
                      <button
                        onClick={() => setPreviewOpenIdx(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between text-right text-xs font-bold text-zinc-200 gap-2 cursor-pointer"
                      >
                        <span>{item.question}</span>
                        <span className="font-mono text-base text-zinc-500 shrink-0">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="font-black text-base text-white">
                {editingFaq ? "تعديل السؤال" : "إضافة سؤال جديد"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/14 flex items-center justify-center text-zinc-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">نص السؤال</label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="كيف أستعلم عن مطابقة الفلتر؟"
                  className="w-full px-3 py-2.5 text-xs bg-white/6 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">نص الجواب</label>
                <textarea
                  required
                  rows={4}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="اكتب التوضيح المفصل..."
                  className="w-full px-3 py-2.5 text-xs bg-white/6 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="faqActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-white/20 w-4 h-4 cursor-pointer accent-blue-500"
                />
                <label htmlFor="faqActive" className="text-xs font-bold text-zinc-400 cursor-pointer">
                  تفعيل وعرضه في الموقع مباشرة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/8">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 hover:bg-white/6 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#004bb5] hover:bg-[#1a5fc8] text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
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

