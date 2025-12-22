import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能课程助教系统",
  description: "基于 RAG 技术的课程问答与辅助学习系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
