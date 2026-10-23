import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "العاني للفلتر | AL ANI Filter — أنظمة تنقية المياه المتطورة",
  description: "الرائد في أنظمة تنقية وتحلية المياه في العراق • منظومات R.O والشمعات الأصلية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="scroll-smooth">
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
