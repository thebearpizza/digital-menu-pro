'use client'

import { useState } from 'react'
import { generatePairingCode, unlinkChat } from './actions'
import { Spinner } from '@/components/ui/Spinner'

interface Props {
  links: { chat_id: number; created_at: string }[]
}

export default function TelegramClient({ links: initialLinks }: Props) {
  const [links, setLinks] = useState(initialLinks)
  const [code, setCode]   = useState<string | null>(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setBusy(true); setError(null)
    try { setCode(await generatePairingCode()) }
    catch (e: any) { setError(e?.message ?? 'Errore') }
    finally { setBusy(false) }
  }

  async function handleUnlink(chatId: number) {
    if (!confirm('Scollegare questa chat Telegram?')) return
    try {
      await unlinkChat(chatId)
      setLinks(prev => prev.filter(l => l.chat_id !== chatId))
    } catch (e: any) { setError(e?.message ?? 'Errore') }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Bot Telegram</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestisci menu, prezzi e visibilità scrivendo al bot — anche dal telefono, senza aprire il gestionale.
        </p>
      </div>

      <div className="bg-white border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Collega una chat</h2>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1 mb-4">
          <li>Genera un codice qui sotto (vale 15 minuti, monouso)</li>
          <li>Apri il bot su Telegram e invia: <code className="bg-gray-100 px-1.5 py-0.5 text-xs">/collega CODICE</code></li>
          <li>Da quel momento la chat può gestire i tuoi ristoranti</li>
        </ol>
        {code ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl tracking-[0.3em] bg-gray-900 text-white px-4 py-2 select-all">{code}</span>
            <span className="text-xs text-gray-400">Invia al bot: <code>/collega {code}</code></span>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={busy}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[120px] flex items-center justify-center"
          >
            {busy ? <Spinner color="#fff" /> : 'Genera codice'}
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      <div className="bg-white border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Chat collegate</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-400">Nessuna chat collegata.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {links.map(l => (
              <li key={l.chat_id} className="py-2.5 flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  Chat <span className="font-mono">{l.chat_id}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    dal {new Date(l.created_at).toLocaleDateString('it-IT')}
                  </span>
                </span>
                <button
                  onClick={() => handleUnlink(l.chat_id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Scollega
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Comandi disponibili</h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{`/lista — ristoranti e menu con stato
prezzo Carbonara 12,50 [menu Pranzo]
attiva / disattiva piatto Carbonara [menu Pranzo]
attiva / disattiva categoria Antipasti [menu Cena]
attiva / disattiva menu Bar
attiva / disattiva ristorante Da Mario
programma menu Bar dalle 8 alle 12
rimuovi programmazione menu Bar`}</pre>
      </div>
    </div>
  )
}
