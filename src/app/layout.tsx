import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: 'Live Pitch',
  description:
    'Premium tournament management platform for modern sports organizations.',
  other: {
    google: 'notranslate',
  },
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bs" className="theme-dark notranslate" suppressHydrationWarning>
      <body className="notranslate">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:px-3 focus:py-2"
          style={{
            backgroundColor: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        >
          Skip to main content
        </a>
        <AppProviders>
          <ThemeProvider>{children}</ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
