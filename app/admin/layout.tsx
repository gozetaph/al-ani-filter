"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const verifyAdminUser = async (user: { id: string; email?: string } | null) => {
      if (!user) {
        if (!active) return;
        setIsAuthenticated(false);
        setUserEmail(null);
        setAuthLoading(false);
        return;
      }

      const { data: adminRow, error: adminErr } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (adminErr || !adminRow) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setUserEmail(null);
        setAuthError("هذا الحساب غير مخول للوصول إلى لوحة الإدارة (غير مضاف في admin_users)");
      } else {
        setIsAuthenticated(true);
        setUserEmail(user.email ?? null);
      }
      setAuthLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => {
      verifyAdminUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      verifyAdminUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        return;
      }

      const { data: adminRow, error: adminErr } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (adminErr || !adminRow) {
        await supabase.auth.signOut();
        setAuthError("هذا الحساب غير مخول للوصول إلى لوحة الإدارة");
        return;
      }

      setIsAuthenticated(true);
      setUserEmail(data.user.email ?? null);
      setPassword("");
    } catch {
      setAuthError("تعذر الاتصال بخدمة التحقق، حاول مجدداً");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserEmail(null);
    setPassword("");
  };

  if (authLoading) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center text-neutral-400 text-xs"
        style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
      >
        جاري التحقق من الجلسة...
      </div>
    );
  }

  // ── SUPABASE AUTH LOGIN SCREEN ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center p-4 antialiased text-white"
        style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
        dir="rtl"
      >
        <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-8 shadow-2xl flex flex-col items-center text-center">
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-6" dir="ltr">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Image src="/logo_a_trans.png" alt="A" width={24} height={24} className="h-6 w-auto object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold text-white tracking-tight">AL ANI FILTERS</h1>
              <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Control Panel</p>
            </div>
          </div>

          <p className="text-xs text-neutral-300 mb-6 font-semibold">
            تسجيل دخول المسؤول عبر حساب الإدارة المعتمد
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-4 text-right">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@alanifilters.com"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500 transition text-left"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-blue-500 transition text-left"
              />
            </div>

            {authError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              {submitting ? "جاري تسجيل الدخول..." : "دخول إلى لوحة الإدارة"}
            </button>
          </form>

          <Link href="/" className="text-xs text-neutral-400 hover:text-white transition mt-5">
            ← العودة لكتالوج الموقع
          </Link>
        </div>
      </div>
    );
  }

  // ── 4 TABS NAVIGATION ────────────────────────────────────────────────────
  const navItems = [
    {
      href: "/admin",
      label: "لوحة التحكم",
      labelEn: "Dashboard",
      badge: "الرئيسية",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: "/admin/items",
      label: "مخزون المواد والفلاتر",
      labelEn: "Stock of Items",
      badge: "المخزون",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      href: "/admin/faq",
      label: "الأسئلة الشائعة (FAQ)",
      labelEn: "FAQ Management",
      badge: "ديناميكي",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: "/admin/settings",
      label: "إعدادات النظام",
      labelEn: "Settings",
      badge: "النظام",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div 
      className="min-h-screen bg-black text-neutral-100 flex antialiased"
      style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
    >
      
      {/* ── MOBILE OVERLAY BACKDROP ──────────────────────────────────────── */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ── 4-TAB ADMIN SIDEBAR (Pure Black) ────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-[#0a0a0a] border-l border-neutral-800 transition-all duration-300 ease-in-out lg:static ${
          isSidebarOpen ? "w-64" : "w-20"
        } ${
          isMobileSidebarOpen ? "translate-x-0 w-64" : "translate-x-full lg:translate-x-0"
        }`}
        dir="rtl"
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-neutral-800 shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Image src="/logo_a_trans.png" alt="العاني" width={20} height={20} className="h-5 w-auto object-contain" />
            </div>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <div className="overflow-hidden">
                <span className="font-extrabold text-sm text-white block leading-tight tracking-tight">
                  العاني للفلاتر
                </span>
                <span className="text-[10px] text-neutral-400 font-mono block">
                  لوحة الإدارة
                </span>
              </div>
            )}
          </Link>
          
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Navigation Menu (4 Tabs) */}
        <div className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          {(isSidebarOpen || isMobileSidebarOpen) && (
            <p className="px-3 text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2 font-mono">
              القائمة الرئيسية
            </p>
          )}

          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                }`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <span className={`${active ? "text-white" : "text-neutral-400 group-hover:text-blue-400"}`}>
                    {item.icon}
                  </span>
                  {(isSidebarOpen || isMobileSidebarOpen) && (
                    <span>{item.label}</span>
                  )}
                </div>

                {(isSidebarOpen || isMobileSidebarOpen) && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                      active ? "bg-white/20 text-white" : "bg-neutral-900 text-neutral-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer Widget */}
        <div className="p-3 border-t border-neutral-800 space-y-2 shrink-0">
          {(isSidebarOpen || isMobileSidebarOpen) && userEmail && (
            <div className="px-3 py-1.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80 text-[10px] text-neutral-400 font-mono truncate" dir="ltr" title={userEmail}>
              {userEmail}
            </div>
          )}
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-semibold transition"
          >
            <svg className="w-4 h-4 shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <span>معاينة الموقع الرئيسي ↗</span>
            )}
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <span>تسجيل الخروج والقفل</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT SHELL ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-black">
        
        {/* Top Header */}
        <header className="h-16 bg-[#0a0a0a] border-b border-neutral-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
          
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-neutral-900 text-neutral-300 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white transition"
              title="طي / توسيع القائمة"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb path */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-neutral-400" dir="rtl">
              <span className="text-neutral-500">لوحة الإدارة</span>
              <span>/</span>
              <span className="text-white font-bold">
                {navItems.find((n) => isActive(n.href))?.label || "الرئيسية"}
              </span>
            </div>
          </div>

          {/* Right Header: Shortcut to Site */}
          <div className="flex items-center gap-3" dir="rtl">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition border border-neutral-800"
            >
              <span>الموقع ↗</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-black">
          {children}
        </main>

      </div>

    </div>
  );
}
