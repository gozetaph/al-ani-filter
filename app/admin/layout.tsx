"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";

const EXPECTED_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "12345678";
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const SESSION_KEY = "al_ani_admin_v2";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Brute-force state
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsClient(true);
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.auth === true && parsed.exp > Date.now()) {
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }

    try {
      const lockData = sessionStorage.getItem("al_ani_lockout");
      if (lockData) {
        const { until, count } = JSON.parse(lockData);
        if (until > Date.now()) {
          setLockedUntil(until);
          setAttempts(count);
        } else {
          sessionStorage.removeItem("al_ani_lockout");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockedUntil) {
      const updateCountdown = () => {
        const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockedUntil(null);
          setAttempts(0);
          setLockCountdown(0);
          sessionStorage.removeItem("al_ani_lockout");
          if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        } else {
          setLockCountdown(remaining);
        }
      };
      updateCountdown();
      lockTimerRef.current = setInterval(updateCountdown, 1000);
      return () => {
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      };
    }
  }, [lockedUntil]);

  // Keyboard typing
  useEffect(() => {
    if (isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockedUntil && lockedUntil > Date.now()) return;
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
      else if (e.key === "Escape") handleClear();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, isAuthenticated, lockedUntil]);

  const handleDigit = (d: string) => {
    if (lockedUntil && lockedUntil > Date.now()) return;
    if (pin.length >= 8) return;
    triggerHaptic("light");
    setHasError(false);
    const nextPin = pin + d;
    setPin(nextPin);

    if (nextPin.length === 8) {
      const isCorrect = nextPin === EXPECTED_PIN;
      if (isCorrect) {
        triggerHaptic("medium");
        const expiry = Date.now() + 8 * 60 * 60 * 1000;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ auth: true, exp: expiry }));
        setAttempts(0);
        sessionStorage.removeItem("al_ani_lockout");
        setTimeout(() => setIsAuthenticated(true), 150);
      } else {
        triggerHaptic("medium");
        setHasError(true);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockedUntil(until);
          sessionStorage.setItem("al_ani_lockout", JSON.stringify({ until, count: newAttempts }));
        }

        setTimeout(() => {
          setPin("");
          setHasError(false);
        }, 800);
      }
    }
  };

  const handleBackspace = () => {
    if (lockedUntil && lockedUntil > Date.now()) return;
    triggerHaptic("light");
    setPin((p) => p.slice(0, -1));
    setHasError(false);
  };

  const handleClear = () => {
    if (lockedUntil && lockedUntil > Date.now()) return;
    triggerHaptic("light");
    setPin("");
    setHasError(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setPin("");
    setAttempts(0);
  };

  if (!isClient) return <div className="min-h-screen bg-gray-900" />;

  // ── PIN AUTH SCREEN (TailAdmin styled card) ──────────────────────────────
  if (!isAuthenticated) {
    const isLocked = lockedUntil !== null && lockedUntil > Date.now();
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/90 p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
          
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-6" dir="ltr">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Image src="/logo_a_trans.png" alt="A" width={24} height={24} className="h-6 w-auto object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold text-white tracking-tight">AL ANI FILTERS</h1>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Control Panel</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-6 font-medium">
            {isLocked
              ? `محاولات خاطئة كثيرة. انتظر ${lockCountdown} ثانية`
              : "أدخل رمز المرور المكون من 8 أرقام"}
          </p>

          {/* Dots Indicator */}
          <div className={`flex items-center justify-center gap-3 mb-6 ${hasError ? "animate-shake" : ""}`}>
            {Array.from({ length: 8 }).map((_, idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    isLocked
                      ? "bg-amber-500/50"
                      : hasError
                      ? "bg-rose-500 scale-110"
                      : isFilled
                      ? "bg-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                />
              );
            })}
          </div>

          {hasError && !isLocked && (
            <p className="text-xs font-bold text-rose-400 mb-4 animate-pulse">
              {attempts >= MAX_ATTEMPTS - 1 ? "تحذير: محاولة أخيرة قبل القفل" : "رمز غير صحيح، حاول مجدداً"}
            </p>
          )}

          {isLocked && (
            <div className="mb-4 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
              <p className="text-xs font-bold text-amber-400">
                🔒 تم قفل اللوحة مؤقتاً ({lockCountdown}s)
              </p>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px] mb-5" dir="ltr">
            {["1","2","3","4","5","6","7","8","9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                disabled={isLocked}
                className="h-13 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 active:scale-95 disabled:opacity-30 text-white text-lg font-bold transition border border-gray-700/50 cursor-pointer font-mono"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isLocked}
              className="h-13 rounded-xl text-xs font-bold text-gray-400 hover:text-white active:scale-95 disabled:opacity-30 transition cursor-pointer"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={isLocked}
              className="h-13 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 active:scale-95 disabled:opacity-30 text-white text-lg font-bold transition border border-gray-700/50 cursor-pointer font-mono"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isLocked}
              className="h-13 rounded-xl text-sm font-bold text-gray-400 hover:text-white active:scale-95 disabled:opacity-30 transition cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition mt-2">
            ← العودة لكتالوج الموقع
          </Link>
        </div>
      </div>
    );
  }

  // ── TAILADMIN DASHBOARD LAYOUT ───────────────────────────────────────────
  const navItems = [
    {
      href: "/admin",
      label: "نظرة عامة والكتالوج",
      labelEn: "Overview",
      badge: "الرئيسية",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: "/admin/items",
      label: "إدارة الفلاتر والمواد",
      labelEn: "Filters & Products",
      badge: "80+ مادة",
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
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex antialiased">
      
      {/* ── MOBILE OVERLAY BACKDROP ──────────────────────────────────────── */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ── TAILADMIN SIDEBAR ────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-gray-900 border-l border-gray-800 transition-all duration-300 ease-in-out lg:static ${
          isSidebarOpen ? "w-64" : "w-20"
        } ${
          isMobileSidebarOpen ? "translate-x-0 w-64" : "translate-x-full lg:translate-x-0"
        }`}
        dir="rtl"
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800 shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Image src="/logo_a_trans.png" alt="العاني" width={20} height={20} className="h-5 w-auto object-contain" />
            </div>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <div className="overflow-hidden">
                <span className="font-extrabold text-sm text-white block leading-tight tracking-tight">
                  العاني للفلاتر
                </span>
                <span className="text-[10px] text-gray-400 font-mono block">
                  TailAdmin Dashboard
                </span>
              </div>
            )}
          </Link>
          
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          {(isSidebarOpen || isMobileSidebarOpen) && (
            <p className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 font-mono">
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
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <span className={`${active ? "text-white" : "text-gray-400 group-hover:text-blue-400"}`}>
                    {item.icon}
                  </span>
                  {(isSidebarOpen || isMobileSidebarOpen) && (
                    <span>{item.label}</span>
                  )}
                </div>

                {(isSidebarOpen || isMobileSidebarOpen) && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                      active ? "bg-white/20 text-white" : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer Widget (TailAdmin Style) */}
        <div className="p-3 border-t border-gray-800 space-y-2 shrink-0">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/70 text-xs font-semibold transition"
          >
            <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        
        {/* TailAdmin Top Header */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
          
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
              title="طي / توسيع القائمة"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb path */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-400" dir="rtl">
              <span className="text-gray-500">لوحة الإدارة</span>
              <span>/</span>
              <span className="text-white font-bold">
                {navItems.find((n) => isActive(n.href))?.label || "الرئيسية"}
              </span>
            </div>
          </div>

          {/* Right Header Status & Shortcut */}
          <div className="flex items-center gap-3" dir="rtl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>الكتالوج نشط</span>
            </span>

            <Link
              href="/"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
            >
              <span>الموقع ↗</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
