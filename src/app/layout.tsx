import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineBanner } from '@/components/ConnectionStatus'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Transmission WBS Task Manager',
    template: '%s | Transmission WBS Task Manager',
  },
  description: 'Work Breakdown Structure Task Management for Ohio Valley Electric - Transmission',
  applicationName: 'Transmission WBS Task Manager',
  authors: [{ name: 'Ohio Valley Electric Corporation' }],
  keywords: ['WBS', 'Task Management', 'Project Management', 'Ohio Valley Electric', 'Transmission', 'Smartsheet'],
  robots: {
    index: false, // Internal enterprise app - don't index
    follow: false,
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0066cc',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Preconnect to important origins */}
        <link rel="preconnect" href="https://api.smartsheet.com" />
        
        {/* Enterprise manifest for PWA-like installation */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#0066cc" />
        
        {/* Disable phone number detection on mobile */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 antialiased`}>
        <ErrorBoundary>
          <AuthProvider>
            <OfflineBanner />
            <main className="flex-1">
              {children}
            </main>
          </AuthProvider>
        </ErrorBoundary>
        
        {/* Enterprise footer with version info */}
        <footer className="fixed bottom-0 right-0 p-2 text-xs text-gray-400 pointer-events-none">
          <span className="opacity-50">v1.0.0</span>
        </footer>
      </body>
    </html>
  )
}
