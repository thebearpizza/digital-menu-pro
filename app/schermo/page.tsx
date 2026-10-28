import type { Metadata } from 'next'
import Screen from './Screen'

// Misure dello schermo visibile del telefono (per l'anteprima della
// Personalizzazione, "Il mio telefono"). Pagina pubblica, nessun dato.
export const metadata: Metadata = {
  title: 'Misure dello schermo',
  robots: { index: false, follow: false },
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
}

export default function SchermoPage() {
  return <Screen />
}
