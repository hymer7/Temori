import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Temori · 让小组的每一步都有下文", template: "%s · Temori" },
  description: "Temori 是面向学生团队的网页端协作空间，帮助小组记录任务、分工、成果版本与验收。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
