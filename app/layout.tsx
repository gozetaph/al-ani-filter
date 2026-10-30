import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "محل العاني للفلتر | Al Ani Filter — وكالة فلاتر أساس ASAS الأصلية",
  description: "الرائد في فلاتر المحركات الأصلية للسيارات والشاحنات والمولدات في العراق • وكالة أساس ASAS التركية المعتمدة مع التوصيل لكافة المحافظات والدفع عند الاستلام",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="scroll-smooth">
      <body className="min-h-screen flex flex-col antialiased bg-[#f6f6f6] text-[#111111]">
        {children}
      </body>
    </html>
  );
}
