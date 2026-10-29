"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { triggerHaptic } from "@/lib/haptics";

const EXPECTED_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "12345678";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const authStatus = sessionStorage.getItem("al_ani_admin_auth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Listen to physical keyboard typing
  useEffect(() => {
    if (isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isAuthenticated]);

  const handleDigit = (d: string) => {
    if (pin.length >= 8) return;
    triggerHaptic("light");
    setHasError(false);

    const nextPin = pin + d;
    setPin(nextPin);

    if (nextPin.length === 8) {
      if (nextPin === EXPECTED_PIN) {
        triggerHaptic("medium");
        sessionStorage.setItem("al_ani_admin_auth", "true");
        setTimeout(() => setIsAuthenticated(true), 150);
      } else {
        triggerHaptic("medium");
        setHasError(true);
        setTimeout(() => {
          setPin("");
          setHasError(false);
        }, 800);
      }
    }
  };

  const handleBackspace = () => {
    triggerHaptic("light");
    setPin((prev) => prev.slice(0, -1));
    setHasError(false);
  };

  const handleClear = () => {
    triggerHaptic("light");
    setPin("");
    setHasError(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("al_ani_admin_auth");
    setIsAuthenticated(false);
    setPin("");
  };

  // Wait for client mount
  if (!isClient) {
    return <div className="min-h-screen bg-[#F7F6F2]" />;
  }

  // If NOT authenticated -> Display Apple-style 8-digit PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-4 antialiased selection:bg-[#004bb5] selection:text-white">
        <div className="w-full max-w-sm amazing-glass-card rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-xl text-center">
          
          {/* Logo Lockup */}
          <div className="flex items-center gap-2 mb-4" dir="ltr">
            <Image src="/logo_a_blue_trans.png" alt="العاني" width={34} height={34} className="h-8 w-auto object-contain" />
            <Image src="/logo_text_blue_trans.png" alt="للفلتر" width={90} height={30} className="h-7 w-auto object-contain" />
          </div>

          <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
            لوحة الإدارة والمخزن
          </h2>
          <p className="text-xs text-zinc-500 mt-1 mb-6">
            أدخل رمز المرور السري (8 أرقام) للوصول
          </p>

          {/* 8 PIN Dots */}
          <div className={`flex items-center justify-center gap-2 sm:gap-2.5 mb-6 ${hasError ? "animate-shake" : ""}`}>
            {Array.from({ length: 8 }).map((_, idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full transition-all duration-200 ${
                    hasError
                      ? "bg-rose-500 scale-110 shadow-sm"
                      : isFilled
                      ? "bg-[#004bb5] scale-110 shadow-sm"
                      : "bg-zinc-200 border border-zinc-300"
                  }`}
                />
              );
            })}
          </div>

          {hasError && (
            <p className="text-xs font-bold text-rose-600 mb-4 animate-pulse">
              الرمز غير صحيح، يرجى المحاولة ثانية
            </p>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[260px] mb-4" dir="ltr">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-13 sm:h-14 rounded-2xl amazing-glass-pill text-lg font-bold text-zinc-800 hover:text-[#004bb5] active:scale-95 transition flex items-center justify-center cursor-pointer shadow-2xs font-mono"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-13 sm:h-14 rounded-2xl text-xs font-bold text-zinc-400 hover:text-zinc-700 active:scale-95 transition flex items-center justify-center cursor-pointer"
            >
              مسح
            </button>

            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="h-13 sm:h-14 rounded-2xl amazing-glass-pill text-lg font-bold text-zinc-800 hover:text-[#004bb5] active:scale-95 transition flex items-center justify-center cursor-pointer shadow-2xs font-mono"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="h-13 sm:h-14 rounded-2xl text-base font-bold text-zinc-500 hover:text-zinc-800 active:scale-95 transition flex items-center justify-center cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <Link href="/" className="text-xs text-zinc-400 hover:text-[#004bb5] transition mt-2">
            ← العودة للمتجر
          </Link>

        </div>
      </div>
    );
  }

  // If Authenticated -> Render Full Admin Dashboard
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-zinc-900 flex flex-col antialiased">
      
      {/* Admin Top Navigation */}
      <header className="amazing-glass-nav sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 select-none">
              <div className="h-8 px-2.5 bg-[#004bb5] text-white rounded-lg flex items-center justify-center font-black text-xs">
                ADMIN
              </div>
              <div>
                <span className="font-bold text-sm sm:text-base text-zinc-900 leading-tight block">
                  لوحة إدارة العاني للفلتر
                </span>
                <span className="text-[10px] text-zinc-400 block font-mono">
                  AL ANI FILTER CONTROL PANEL
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links & Lock Button */}
          <nav className="flex items-center gap-2 sm:gap-3 text-xs font-bold">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl text-zinc-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              الإحصائيات
            </Link>
            <Link
              href="/admin/items"
              className="px-3 py-1.5 rounded-xl text-zinc-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              المخزن والمواد
            </Link>
            <Link
              href="/admin/orders"
              className="px-3 py-1.5 rounded-xl text-zinc-600 hover:text-[#004bb5] hover:bg-blue-50 transition"
            >
              الطلبيات والشحن
            </Link>
            <button
              onClick={handleLogout}
              className="mr-2 px-2.5 py-1.5 bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 border border-zinc-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              🔒 قفل
            </button>
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
