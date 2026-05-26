import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "蕉办 Kanbanana",
    template: "%s · 蕉办 Kanbanana",
  },
  description: "一个有点不正经，但认真帮你管理任务的开源项目看板。任务别乱飞，先上蕉办。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
