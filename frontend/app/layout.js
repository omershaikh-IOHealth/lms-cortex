import './globals.css';
import { Providers } from './providers';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

export const metadata = {
  title: 'Cortex LMS',
  description: 'Training & Learning Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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