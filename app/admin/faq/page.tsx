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
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة وتصميم الأسئلة الشائعة (FAQ)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تحكم كامل في نصوص وأسئلة وأجوبة الكتالوج مع معاينة مباشرة لشكلها في الموقع
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#004bb5] hover:bg-[#00388a] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5"
        >
          <span>+ إضافة سؤال جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left/Main Column: Manage FAQs Table/Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                قائمة الأسئلة الشائعة ({faqs.length})
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {faqs.filter((f) => f.is_active !== false).length} ظاهر في الموقع
              </span>
            </div>

            {faqs.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-xs text-slate-400">لا توجد أسئلة حالياً. اضغط على الزر لإضافة أول سؤال!</p>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg"
                >
                  إضافة سؤال
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {faqs.map((faq, idx) => (
                  <div key={faq.id} className="p-4 hover:bg-slate-50/70 transition space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">
                            {faq.question}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <button
                        onClick={() => handleToggleActive(faq.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border transition ${
                          faq.is_active !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {faq.is_active !== false ? "● مفعل" : "○ معطل"}
                      </button>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                      {/* Order Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMove(idx, "up")}
                          disabled={idx === 0}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded text-[11px] font-bold"
                          title="تحريك لأعلى"
                        >
                          ↑ أعلى
                        </button>
                        <button
                          onClick={() => handleMove(idx, "down")}
                          disabled={idx === faqs.length - 1}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded text-[11px] font-bold"
                          title="تحريك لأسفل"
                        >
                          ↓ أسفل
                        </button>
                      </div>

                      {/* Edit / Delete */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(faq)}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#004bb5] font-bold rounded-lg transition"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg transition"
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

        {/* Right Column: Live Website Preview Accordion */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="font-bold text-xs text-slate-400 uppercase tracking-wider font-mono">
                معاينة حية كما تظهر للزوار في الموقع
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="text-center space-y-1 mb-6">
              <h2 className="text-lg font-black text-black">الأسئلة الشائعة</h2>
              <p className="text-[11px] text-neutral-500">إجابات استفسارات الزوار والورش</p>
            </div>

            <div className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
              {faqs
                .filter((f) => f.is_active !== false)
                .map((item, idx) => {
                  const isOpen = previewOpenIdx === idx;
                  return (
                    <div key={item.id} className="py-3 px-3">
                      <button
                        onClick={() => setPreviewOpenIdx(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between text-right text-xs font-bold text-neutral-900 gap-2 cursor-pointer"
                      >
                        <span>{item.question}</span>
                        <span className="font-mono text-base text-neutral-400 shrink-0">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed text-right">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingFaq ? "تعديل السؤال" : "إضافة سؤال جديد للأسئلة الشائعة"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص السؤال (Question)
                </label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="مثال: كيف أستعلم عن مطابقة الفلتر لسيارتي؟"
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#004bb5] font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص الجواب والتوضيح (Answer)
                </label>
                <textarea
                  required
                  rows={4}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="اكتب التوضيح المفصل الذي يظهر للزائر عند الضغط على السؤال..."
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#004bb5] font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="faqActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#004bb5] focus:ring-[#004bb5] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="faqActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  تفعيل السؤال وعرضه في الموقع مباشرة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#004bb5] hover:bg-[#00388a] text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
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

