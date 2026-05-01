import './globals.css';
import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Pigou OS',
  description: 'Pigou 的个人项目操作系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" suppressHydrationWarning><body suppressHydrationWarning><Shell>{children}</Shell><Suspense fallback={null}><AnalyticsTracker /></Suspense></body></html>;
}
