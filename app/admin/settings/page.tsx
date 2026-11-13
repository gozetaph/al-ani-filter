"use client";

import { useState } from "react";
import { triggerHaptic } from "@/lib/haptics";

export default function AdminSettingsPage() {
  const [cleared, setCleared] = useState(false);

  const handleExportBackup = () => {
    triggerHaptic("medium");
    const items = localStorage.getItem("al_ani_custom_items") || "[]";
    const faqs = localStorage.getItem("al_ani_faqs") || "[]";
    const leads = localStorage.getItem("al_ani_whatsapp_leads") || "[]";
    const exportData = {
      timestamp: new Date().toISOString(),
      custom_items: JSON.parse(items),
      faqs: JSON.parse(faqs),
      whatsapp_leads: JSON.parse(leads),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `al_ani_catalog_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearCache = () => {
    if (!confirm("هل أنت متأكد من مسح الذاكرة المؤقتة وإعادة ضبط البيانات؟")) return;
    triggerHaptic("medium");
    localStorage.removeItem("al_ani_custom_items");
    localStorage.removeItem("al_ani_faqs");
    setCleared(true);
    setTimeout(() => {
      setCleared(false);
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-6 text-right max-w-4xl" dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      
      {/* ── TOP HEADER BAR ───────────────────────────────────────────── */}
      <div className="pb-2 border-b border-neutral-800">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          إعدادات النظام والكتالوج
        </h1>
        <p className="text-xs text-neutral-400 mt-1 font-semibold">
          إدارة قنوات التواصل والنسخ الاحتياطي للكتالوج
        </p>
      </div>

      <div className="space-y-5">
        
        {/* Contact Numbers Widget */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <h3 className="font-bold text-sm text-white">أرقام التواصل والاستفسار المعتمدة</h3>
            <span className="text-[10px] text-neutral-400 font-mono">Contact Settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
              <span className="text-[11px] text-neutral-400 font-semibold block">رقم واتساب الأساسي (استفسار القطع):</span>
              <p className="font-mono font-bold text-base text-white" dir="ltr">+964 790 152 6221</p>
              <span className="text-[10px] text-emerald-400 block">● متصل ومفعل في جميع أزرار الموقع</span>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
              <span className="text-[11px] text-neutral-400 font-semibold block">رقم الاتصال المباشر الثانوي:</span>
              <p className="font-mono font-bold text-base text-white" dir="ltr">+964 771 007 7880</p>
              <span className="text-[10px] text-blue-400 block">● متوفر للمكالمات والاستشارات الفنية</span>
            </div>
          </div>
        </div>

        {/* Data & Backup Widget */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <h3 className="font-bold text-sm text-white">النسخ الاحتياطي وإدارة البيانات</h3>
            <span className="text-[10px] text-neutral-400 font-mono">Backup & Storage</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>تحميل نسخة احتياطية (JSON)</span>
            </button>

            <button
              onClick={handleClearCache}
              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-rose-400 border border-neutral-800 hover:border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{cleared ? "تم المسح بنجاح!" : "إعادة ضبط الذاكرة المؤقتة"}</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            النسخة الاحتياطية تحتوي على المواد والأسئلة الشائعة وسجل عملاء واتساب المحفوظ على هذا الجهاز بصيغة JSON.
          </p>
        </div>

      </div>

    </div>
  );
}
