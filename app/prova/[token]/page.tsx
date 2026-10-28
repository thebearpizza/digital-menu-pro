import NewMenuPage, { NEW_MENU_METADATA, type NewMenuSearch } from './NewMenuPage'

// Indirizzo di prova del nuovo menu (anteprime del gestionale, prove): stesso
// contenuto di /m/<token> con il nuovo menu attivo, ma senza statistiche.
//   /prova/<token>            → pagina d'apertura
//   /prova/<token>?menu=<id>  → un menu specifico

export const dynamic = 'force-dynamic'
export const metadata = NEW_MENU_METADATA

export default function ProvaPage({ params, searchParams }: { params: { token: string }; searchParams: NewMenuSearch }) {
  return NewMenuPage({ token: params.token, searchParams, base: '/prova', live: false })
}
