import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { usesNewMenu } from '@/lib/newMenu'
import NewPrivacy, { PRIVACY_METADATA } from '@/app/prova/[token]/privacy/NewPrivacy'

// Informativa privacy del menu digitale (art. 13 GDPR). Testo base: va fatto
// verificare dal consulente del ristorante. Descrive ciò che il menu fa
// davvero: nessun cookie, statistiche anonime senza IP, memoria locale solo per
// lingua e pop-up, caratteri e librerie serviti dal nostro dominio.

export const dynamic = 'force-dynamic'

const OLD_METADATA: Metadata = {
  title: 'Informativa privacy',
  robots: { index: false, follow: false },
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return (await usesNewMenu(params.token)) ? PRIVACY_METADATA : OLD_METADATA
}

export default async function PrivacyPage({ params }: { params: { token: string } }) {
  if (await usesNewMenu(params.token)) return NewPrivacy({ token: params.token, base: '/m' })
  const supabase = await createClient()
  const { data: r } = await supabase
    .from('restaurants')
    .select('name, legal_name, vat_number, legal_address, privacy_email')
    .eq('qr_public_token', params.token)
    .eq('is_active', true)
    .single()
  if (!r) notFound()

  const rest = r as {
    name: string; legal_name: string | null; vat_number: string | null
    legal_address: string | null; privacy_email: string | null
  }
  const owner = rest.legal_name?.trim() || rest.name

  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="max-w-2xl mx-auto px-5 py-10 text-sm leading-relaxed space-y-6">
        <a href={`/m/${params.token}`} className="text-xs text-gray-500 underline underline-offset-2">‹ Torna al menu</a>
        <h1 className="text-xl font-semibold">Informativa privacy – menu digitale</h1>

        <section className="space-y-1">
          <h2 className="font-semibold">Titolare del trattamento</h2>
          <p>{owner}{rest.name && rest.legal_name ? ` (${rest.name})` : ''}</p>
          {rest.legal_address && <p>{rest.legal_address}</p>}
          {rest.vat_number && <p>P.IVA {rest.vat_number}</p>}
          {rest.privacy_email && <p>Email: <a className="underline" href={`mailto:${rest.privacy_email}`}>{rest.privacy_email}</a></p>}
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Quali dati trattiamo</h2>
          <p>Il menu digitale non richiede registrazione e non usa cookie.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Statistiche anonime di utilizzo:</strong> registriamo quante volte il menu viene aperto e quali menu e piatti vengono consultati. Non salviamo il tuo indirizzo IP né altri dati che ti identifichino.</li>
            <li><strong>Memoria locale del dispositivo:</strong> il browser ricorda la lingua scelta e se hai già visto le istruzioni d&apos;uso. Questi dati restano sul tuo dispositivo e non ci vengono inviati.</li>
            <li><strong>Dati tecnici di connessione:</strong> come ogni sito, i server che ospitano il menu ricevono l&apos;indirizzo IP e le informazioni del browser per poter mostrare la pagina e proteggerla dagli abusi; sono conservati solo per il tempo tecnico necessario.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Perché e su quale base</h2>
          <p>Per mostrarti il menu e per capire, in forma aggregata e anonima, quali piatti interessano di più. La base giuridica è il legittimo interesse del titolare (art. 6.1.f GDPR) a offrire e migliorare il servizio.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Fornitori</h2>
          <p>Il menu è ospitato da Vercel Inc. (hosting) e i contenuti sono conservati su Supabase (database con sede nell&apos;Unione Europea, Francoforte), che agiscono come responsabili del trattamento. Caratteri e librerie vengono serviti dallo stesso dominio del menu: il tuo browser non contatta servizi di terze parti come Google Fonts.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">I tuoi diritti</h2>
          <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione od opporti al trattamento (artt. 15-22 GDPR) scrivendo al titolare{rest.privacy_email ? ` all'indirizzo ${rest.privacy_email}` : ''}. Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
        </section>
      </div>
    </main>
  )
}
