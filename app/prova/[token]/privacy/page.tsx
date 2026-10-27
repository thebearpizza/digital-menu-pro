import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FONTS_CSS } from '../fonts'
import { PAPER, SERIF, SANS } from '../typeset'

// Informativa privacy del nuovo menu (art. 13 GDPR), nello stile del menu.
// Testo base da far verificare al consulente del ristorante. Descrive ciò che
// il menu fa davvero: nessun cookie, conteggio anonimo delle aperture, sul
// dispositivo solo lingua scelta e istruzioni già viste, caratteri e file
// serviti dal nostro dominio e dal nostro archivio.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Informativa privacy',
  robots: { index: false, follow: false },
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  themeColor: PAPER,
}

const INK = '#1d1915', SOFT = '#5f574d', ACCENT = '#9a8462'

export default async function PrivacyPage({ params }: { params: { token: string } }) {
  const supabase = await createClient()
  const { data: r } = await supabase
    .from('restaurants')
    .select('name, legal_name, vat_number, legal_address, privacy_email')
    .eq('qr_public_token', params.token)
    .eq('is_active', true)
    .single()
  if (!r) notFound()

  const rest = r as { name: string; legal_name: string | null; vat_number: string | null; legal_address: string | null; privacy_email: string | null }
  const owner = rest.legal_name?.trim() || rest.name

  return (
    <main className="min-h-screen" style={{ background: PAPER, color: INK }}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href={FONTS_CSS} />
      <div className="mx-auto" style={{ maxWidth: 620, padding: 'calc(env(safe-area-inset-top) + 22px) 24px calc(env(safe-area-inset-bottom) + 48px)' }}>
        <a href={`/prova/${params.token}`} className="inline-flex items-center"
          style={{ gap: 6, fontFamily: SANS, fontSize: 13, fontWeight: 600, color: ACCENT }}>
          <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden><path d="M6.5 1.5L1.8 6.5l4.7 5" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Torna al menu
        </a>

        <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: ACCENT, marginTop: 34, textAlign: 'center' }}>
          {rest.name}
        </p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 34, lineHeight: 1.1, textAlign: 'center', marginTop: 10 }}>
          Informativa privacy
        </h1>
        <svg width="96" height="10" viewBox="0 0 96 10" aria-hidden className="mx-auto" style={{ display: 'block', margin: '18px auto 30px' }}>
          <path d="M2 5h36M58 5h36" stroke="#c9bba2" strokeWidth="0.9" /><path d="M48 1.6L51.4 5 48 8.4 44.6 5z" fill={ACCENT} />
        </svg>

        <Section title="Titolare del trattamento">
          <p>{owner}{rest.legal_name && rest.name ? ` (${rest.name})` : ''}</p>
          {rest.legal_address && <p>{rest.legal_address}</p>}
          {rest.vat_number && <p>P.IVA {rest.vat_number}</p>}
          {rest.privacy_email && <p>Email: <a className="underline underline-offset-2" href={`mailto:${rest.privacy_email}`}>{rest.privacy_email}</a></p>}
        </Section>

        <Section title="Quali dati trattiamo">
          <p>Il menu digitale non richiede registrazione e non usa cookie.</p>
          <ul style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <Item title="Statistiche anonime">contiamo quante volte il menu viene aperto, senza salvare il tuo indirizzo IP né altri dati che ti identifichino.</Item>
            <Item title="Memoria del tuo dispositivo">il browser ricorda la lingua che hai scelto e se hai già visto le istruzioni per sfogliare il menu. Questi dati restano sul tuo telefono e non ci vengono inviati.</Item>
            <Item title="Dati tecnici di connessione">come ogni sito, i server che ospitano il menu ricevono l&apos;indirizzo IP e le informazioni del browser per mostrare la pagina e proteggerla dagli abusi; sono conservati solo per il tempo tecnico necessario.</Item>
          </ul>
        </Section>

        <Section title="Perché e su quale base">
          <p>Per mostrarti il menu e capire, in forma aggregata e anonima, quanto viene consultato. La base giuridica è il legittimo interesse del titolare (art. 6.1.f GDPR) a offrire e migliorare il servizio.</p>
        </Section>

        <Section title="Fornitori">
          <p>Il menu è ospitato da Vercel Inc. (hosting); contenuti, foto e video sono conservati su Supabase (sede nell&apos;Unione Europea, Francoforte). Entrambi agiscono come responsabili del trattamento. I caratteri tipografici vengono serviti dallo stesso dominio del menu: il tuo browser non contatta servizi di terze parti come Google Fonts.</p>
        </Section>

        <Section title="I tuoi diritti">
          <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione od opporti al trattamento (artt. 15-22 GDPR) scrivendo al titolare{rest.privacy_email ? ` all'indirizzo ${rest.privacy_email}` : ''}. Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: ACCENT, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: INK, display: 'grid', gap: 4 }}>{children}</div>
    </section>
  )
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li style={{ paddingLeft: 16, position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: '0.62em', width: 5, height: 5, transform: 'rotate(45deg)', background: ACCENT }} />
      <strong style={{ fontWeight: 600 }}>{title}:</strong> <span style={{ color: SOFT }}>{children}</span>
    </li>
  )
}
