import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { AuthProvider } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cortex 2.0 | Support Center Automation',
  description: 'Real-time monitoring and intelligence for MedGulf support operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}