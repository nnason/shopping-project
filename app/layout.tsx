import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fashion Aggregator',
  description: 'Search fashion items across affiliate feeds with live filtering',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  )
}
