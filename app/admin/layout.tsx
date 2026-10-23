import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "لوحة التحكم | العاني للفلتر",
  description: "إدارة المخزون والمبيعات والشحن لشركة العاني للفلتر",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] flex flex-col antialiased">
      
      {/* Admin Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2.5 select-none">
              <div className="h-8 px-2.5 bg-[#004bb5] text-white rounded-lg flex items-center justify-center font-black text-xs">
                ADMIN
              </div>
              <div>
                <span className="font-bold text-sm sm:text-base text-slate-900 leading-tight block">
                  لوحة إدارة العاني للفلتر
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  AL ANI CONSOLE • CONTROL PANEL
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-3 text-xs font-bold">
            <Link
              href="/admin"
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              الإحصائيات والمبيعات
            </Link>
            <Link
              href="/admin/items"
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              المخزن والمواد
            </Link>
            <Link
              href="/admin/orders"
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              الطلبيات والشحن
            </Link>
            <Link
              href="/"
              target="_blank"
              className="mr-2 px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-500 hover:text-slate-900 transition flex items-center gap-1"
            >
              <span>عرض المتجر ↗</span>
            </Link>
          </nav>

        </div>
      </header>

      {/* Admin Subview Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {children}
      </main>

    </div>
  );
}
