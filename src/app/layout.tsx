import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '烟草许可证 · 实地核查布局图',
  description: '通过语音AI快速生成店面布局图，用于烟草许可证实地核查。支持语音输入、智能解析、按比例绘制布局图并导出图片。',
  keywords: ['烟草许可证', '实地核查', '店面布局图', '语音识别', 'AI生成'],
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '布局图生成器',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: '烟草许可证 · 实地核查布局图',
    description: '通过语音AI快速生成店面布局图',
    url: '/',
    siteName: '布局图生成器',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`antialiased`}>
        {children}
        <Script
          strategy="afterInteractive"
          id="register-sw"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
