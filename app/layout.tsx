import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "العاني للفلاتر | Al Ani Filter — فلاتر أصلية ومطابقة هندسية",
  description: "الرائد في فلاتر المحركات الأصلية للسيارات والشاحنات والمولدات والمعدات الثقيلة في العراق • مطابقة دقيقة لكافة الماركات العالمية (Mann, Perkins, Fleetguard, Donaldson, ASAS, MAK)",
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
