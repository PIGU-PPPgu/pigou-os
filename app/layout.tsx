import './globals.css';
import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Pigou OS',
  description: 'Personal project console for Pigou Wu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body><Shell>{children}</Shell></body></html>;
}
