'use client'

// Sfera flottante in basso a destra dell'admin: parla (Web Speech API,
// riconoscimento it-IT del browser) o scrivi, e l'assistente AI esegue le
// modifiche al menu come il bot Telegram. Le eliminazioni chiedono conferma.

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Msg { role: 'user' | 'bot'; text: string }

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export default function VoiceAssistant() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<any>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recRef = useRef<any>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSpeechSupported(!!getSpeechRecognition()) }, [])

  // Se l'utente naviga via mentre il microfono è attivo, il riconoscimento
  // continuerebbe a girare e a chiamare setState su un componente smontato.
  useEffect(() => () => {
    const rec = recRef.current
    if (rec) {
      rec.onresult = null
      rec.onend = null
      rec.onerror = null
      try { rec.abort() } catch { /* già fermo */ }
      recRef.current = null
    }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, interim, busy])

  function startListening() {
    const SR = getSpeechRecognition()
    if (!SR || listening) return
    const rec = new SR()
    rec.lang = 'it-IT'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let finalText = '', interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        send(finalText.trim())
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => { setListening(false); setInterim('') }
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  function stopListening() {
    recRef.current?.stop()
    setListening(false)
  }

  async function send(text: string, confirmedIntent?: any) {
    if (busy) return
    setBusy(true)
    setPendingConfirm(null)
    if (text) setMessages(m => [...m, { role: 'user', text }])
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(confirmedIntent ? { confirmedIntent } : { text }),
      })
      const json = await res.json()
      setMessages(m => [...m, { role: 'bot', text: json.reply ?? 'Errore.' }])
      if (json.confirm) {
        setPendingConfirm(json.confirm)
      } else {
        router.refresh() // la pagina admin mostra subito le modifiche
      }
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Errore di rete, riprova.' }])
    } finally {
      setBusy(false)
    }
  }

  function submitInput(e: React.FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    setInput('')
    send(t)
  }

  return (
    <>
      {/* Pannello conversazione */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[400] w-80 max-w-[calc(100vw-2.5rem)] bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Assistente menu</div>
              <div className="text-[11px] text-blue-100">
                {speechSupported ? 'Parla o scrivi cosa fare' : 'Scrivi cosa fare'}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-blue-100 hover:text-white text-lg leading-none px-1" aria-label="Chiudi">
              ✕
            </button>
          </div>

          <div ref={logRef} className="flex-1 max-h-72 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.length === 0 && !interim && (
              <p className="text-xs text-gray-400 px-1">
                Esempi: «metti la carbonara a 12,50», «aggiungi il tiramisù a 6 euro nei dolci», «disattiva il menu Cena»…
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap rounded-lg ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {interim && (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 text-sm rounded-lg bg-blue-100 text-blue-700 italic">
                  {interim}…
                </div>
              </div>
            )}
            {busy && <div className="text-xs text-gray-400 px-1">Sto lavorando…</div>}
            {pendingConfirm && !busy && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => send('', pendingConfirm)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Conferma
                </button>
                <button
                  onClick={() => { setPendingConfirm(null); setMessages(m => [...m, { role: 'bot', text: 'Ok, annullato 👍' }]) }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>

          <form onSubmit={submitInput} className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-200 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Scrivi un comando…"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="text-blue-600 disabled:text-gray-300 font-medium text-sm px-2" aria-label="Invia">
              Invia
            </button>
          </form>
        </div>
      )}

      {/* Sfera flottante: aperta → microfono; chiusa → apre il pannello */}
      <button
        onClick={() => {
          if (!open) { setOpen(true); return }
          if (!speechSupported) return
          listening ? stopListening() : startListening()
        }}
        className={`fixed bottom-5 right-5 z-[400] w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all
          ${listening
            ? 'bg-red-500 animate-pulse scale-110'
            : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:scale-105'}`}
        aria-label={open ? (listening ? 'Ferma ascolto' : 'Parla') : 'Apri assistente'}
        title={open ? (listening ? 'Ferma ascolto' : 'Parla') : 'Assistente menu'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
    </>
  )
}
