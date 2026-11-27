import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoFlow · 项目事实层",
  description:
    "多人 + 多 AI Agent 的项目协作工作台：在同一项目事实层上分工、协作、交付。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
