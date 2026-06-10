import type { Metadata, Viewport } from 'next'
import { ServiceWarmup } from '@/components/service-warmup'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pathway Prep Exams',
  description: 'Computer-based testing for Pathway Prep learners',
  icons: { icon: '/logo.png', apple: '/logo.png' },
}

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body className="min-h-dvh overflow-x-hidden font-sans antialiased">
        <ServiceWarmup />
        {children}
      </body>
    </html>
  )
}
