import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Cortex LMS',
  description: 'Training & Learning Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Providers>
            <AuthProvider>
              {children}
            </AuthProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}