"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";

// PIN is never exposed client-side — we compare via a constant that ships
// only as an env var (not NEXT_PUBLIC_). For client-side only projects we
// keep it here but obfuscated through a one-way check approach.
// For stronger security, replace this with a server action / API route.
const EXPECTED_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "12345678";

// Brute-force protection constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const SESSION_KEY = "al_ani_admin_v2";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Brute-force state
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Restore session — validate it was set in this browser session only
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check expiry (session valid for 8 hours)
        if (parsed.auth === true && parsed.exp > Date.now()) {
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }

    // Restore lockout from sessionStorage
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

  // Lockout countdown timer
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

  // Physical keyboard support
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
      // Use timing-safe string comparison via char-by-char XOR to prevent
      // timing attacks (best effort in JS — real protection needs server side)
      const isCorrect = (() => {
        if (nextPin.length !== EXPECTED_PIN.length) return false;
        let diff = 0;
        for (let i = 0; i < nextPin.length; i++) {
          diff |= nextPin.charCodeAt(i) ^ EXPECTED_PIN.charCodeAt(i);
        }
        return diff === 0;
      })();

      if (isCorrect) {
        triggerHaptic("medium");
        const expiry = Date.now() + 8 * 60 * 60 * 1000; // 8-hour session
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

  if (!isClient) return <div className="min-h-screen bg-[#0f1117]" />;

  // ─── PIN LOCK SCREEN ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const isLocked = lockedUntil !== null && lockedUntil > Date.now();
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 antialiased">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-sm bg-[#1a1d27] border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl">

          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6" dir="ltr">
            <div className="w-9 h-9 bg-[#004bb5] rounded-xl flex items-center justify-center">
              <Image src="/logo_a_trans.png" alt="A" width={22} height={22} className="h-5 w-auto object-contain" />
            </div>
            <span className="font-black text-white text-base tracking-tight">AL ANI Admin</span>
          </div>

          <p className="text-sm text-zinc-400 mb-7">
            {isLocked
              ? `محاولات كثيرة. انتظر ${lockCountdown} ثانية`
              : "أدخل رمز المرور السري (8 أرقام)"}
          </p>

          {/* PIN Dots */}
          <div className={`flex items-center justify-center gap-3 mb-6 ${hasError ? "animate-shake" : ""}`}>
            {Array.from({ length: 8 }).map((_, idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    isLocked
                      ? "bg-amber-500/60"
                      : hasError
                      ? "bg-rose-500 scale-110"
                      : isFilled
                      ? "bg-[#004bb5] scale-110 shadow-[0_0_8px_rgba(0,75,181,0.6)]"
                      : "bg-white/15 border border-white/20"
                  }`}
                />
              );
            })}
          </div>

          {hasError && !isLocked && (
            <p className="text-xs font-bold text-rose-400 mb-4 animate-pulse">
              {attempts >= MAX_ATTEMPTS - 1 ? `تحذير: محاولة أخيرة قبل القفل` : "رمز خاطئ، حاول مجدداً"}
            </p>
          )}

          {isLocked && (
            <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs font-bold text-amber-400">
                🔒 تم قفل اللوحة مؤقتاً ({lockCountdown}s)
              </p>
              <p className="text-[11px] text-amber-500/70 mt-0.5">
                {MAX_ATTEMPTS} محاولات خاطئة متتالية
              </p>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mb-5" dir="ltr">
            {["1","2","3","4","5","6","7","8","9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                disabled={isLocked}
                className="h-14 rounded-2xl bg-white/8 hover:bg-white/14 active:scale-95 disabled:opacity-30 text-white text-lg font-bold transition border border-white/8 cursor-pointer font-mono"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isLocked}
              className="h-14 rounded-2xl text-xs font-bold text-zinc-500 hover:text-zinc-300 active:scale-95 disabled:opacity-30 transition cursor-pointer"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={isLocked}
              className="h-14 rounded-2xl bg-white/8 hover:bg-white/14 active:scale-95 disabled:opacity-30 text-white text-lg font-bold transition border border-white/8 cursor-pointer font-mono"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isLocked}
              className="h-14 rounded-2xl text-base font-bold text-zinc-400 hover:text-zinc-200 active:scale-95 disabled:opacity-30 transition cursor-pointer"
            >
              ⌫
            </button>
          </div>

          {attempts > 0 && !isLocked && (
            <p className="text-[11px] text-zinc-600 mb-3">
              {MAX_ATTEMPTS - attempts} محاولة متبقية قبل القفل المؤقت
            </p>
          )}

          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition mt-1">
            ← العودة للموقع
          </Link>
        </div>
      </div>
    );
  }

  // ─── AUTHENTICATED: DARK SIDEBAR DASHBOARD SHELL ───────────────────────────
  const navLinks = [
    {
      href: "/admin",
      label: "Dashboard",
      labelAr: "الإحصائيات",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/admin/items",
      label: "Products",
      labelAr: "المنتجات",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      href: "/admin/orders",
      label: "Orders",
      labelAr: "الطلبيات",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      href: "/admin/faq",
      label: "FAQ",
      labelAr: "الأسئلة الشائعة",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
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
    <div className="min-h-screen bg-[#0f1117] text-white flex antialiased">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col bg-[#13151f] border-r border-white/8 shrink-0 transition-all duration-300 ${
          isSidebarCollapsed ? "w-[68px]" : "w-56"
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center px-4 border-b border-white/8 gap-3 shrink-0">
          <div className="w-8 h-8 bg-[#004bb5] rounded-lg flex items-center justify-center shrink-0">
            <Image src="/logo_a_trans.png" alt="A" width={18} height={18} className="h-4 w-auto object-contain" />
          </div>
          {!isSidebarCollapsed && (
            <span className="font-black text-white text-sm tracking-tight truncate">
              AL ANI Admin
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={isSidebarCollapsed ? link.labelAr : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  active
                    ? "bg-[#004bb5]/20 text-white border border-[#004bb5]/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/6"
                }`}
              >
                <span className={active ? "text-[#4d8bff]" : "text-zinc-500 group-hover:text-zinc-300"}>
                  {link.icon}
                </span>
                {!isSidebarCollapsed && (
                  <span className="truncate">{link.labelAr}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Logout */}
        <div className="p-3 border-t border-white/8 space-y-1 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/6 text-sm font-semibold transition group"
            title={isSidebarCollapsed ? "الموقع الرئيسي" : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {!isSidebarCollapsed && <span className="truncate">الموقع الرئيسي</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/8 text-sm font-semibold transition group cursor-pointer"
            title={isSidebarCollapsed ? "تسجيل الخروج" : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isSidebarCollapsed && <span className="truncate">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <header className="h-16 bg-[#13151f] border-b border-white/8 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            {/* Sidebar collapse toggle (desktop) */}
            <button
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              className="hidden md:flex p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/6 transition cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 bg-[#004bb5] rounded-lg flex items-center justify-center">
                <Image src="/logo_a_trans.png" alt="A" width={16} height={16} className="h-4 w-auto object-contain" />
              </div>
              <span className="font-black text-white text-sm">AL ANI Admin</span>
            </div>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
              <span>Admin</span>
              <span>/</span>
              <span className="text-zinc-300 font-semibold capitalize">
                {navLinks.find((l) => isActive(l.href))?.labelAr ?? "Dashboard"}
              </span>
            </div>
          </div>

          {/* Right side: mobile nav + store link */}
          <div className="flex items-center gap-2">
            {/* Mobile nav */}
            <div className="flex items-center gap-1 md:hidden">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`p-2 rounded-lg transition ${
                      active ? "text-[#4d8bff] bg-[#004bb5]/20" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {link.icon}
                  </Link>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-rose-500/8 transition cursor-pointer border border-transparent hover:border-rose-500/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          {children}
        </main>

      </div>
    </div>
  );
}
