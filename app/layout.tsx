import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NoZoom from './NoZoom'

const inter = Inter({ subsets: ['latin'] })

// Blocca lo zoom su tutta l'app: schermo sempre interamente visibile, nessuno
// zoom da pinch, doppio-tap o focus sugli input. (iOS Safari ignora
// user-scalable/maximum-scale → la prevenzione runtime è in <NoZoom />.)
export const metadata: Metadata = {
  title: 'Digital Menu Pro',
  description: 'Menu digitale per ristoranti',
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>
        <NoZoom />
        {children}
      </body>
    </html>
  )
}
