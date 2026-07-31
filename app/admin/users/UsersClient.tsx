'use client'
// ─────────────────────────────────────────────────────────────────────────────
// UI gestione account. Stile allineato al resto del gestionale (tabella bianca
// su bordo grigio, azioni a destra, bottoni blu/rosso come in Ristoranti).
//
// Nota: qui non c'è alcuna logica di sicurezza — ogni azione è validata di
// nuovo lato server (vedi actions.ts). L'eliminazione mostra il numero di
// ristoranti posseduti perché è l'informazione che determina se l'operazione
// sarà accettata o rifiutata.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import {
  createUserAccount, updateUserAccount, deleteUserAccount, type ManagedUser,
} from './actions'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default function UsersClient({
  users, currentUserId,
}: {
  users: ManagedUser[]
  currentUserId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail]     = useState('')
  const [newPassword, setNewPass]   = useState('')

  const [editing, setEditing]       = useState<ManagedUser | null>(null)
  const [editEmail, setEditEmail]   = useState('')
  const [editPass, setEditPass]     = useState('')

  const [error, setError]           = useState<string | null>(null)
  const [notice, setNotice]         = useState<string | null>(null)
  const [busy, setBusy]             = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setNotice(null); setBusy(true)
    const res = await createUserAccount(newEmail, newPassword)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setNotice(`Account ${newEmail.trim().toLowerCase()} creato. Comunica le credenziali di persona.`)
    setNewEmail(''); setNewPass(''); setCreateOpen(false)
    refresh()
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError(null); setNotice(null); setBusy(true)
    const res = await updateUserAccount(editing.id, { email: editEmail, password: editPass })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setNotice(`Account aggiornato.`)
    setEditing(null); setEditEmail(''); setEditPass('')
    refresh()
  }

  async function handleDelete(u: ManagedUser) {
    const msg = u.restaurants > 0
      ? `"${u.email}" possiede ${u.restaurants} ristorante/i: l'eliminazione verrà rifiutata per non distruggere menu, piatti e QR code. Procedere comunque con il tentativo?`
      : `Eliminare definitivamente l'account "${u.email}"? L'operazione non è reversibile.`
    if (!confirm(msg)) return

    setError(null); setNotice(null); setBusy(true)
    const res = await deleteUserAccount(u.id)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setNotice(`Account ${u.email} eliminato.`)
    refresh()
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Utenti</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} account · la registrazione pubblica è disattivata: gli account si creano solo da qui
          </p>
        </div>
        <button
          onClick={() => { setCreateOpen(v => !v); setError(null); setNotice(null) }}
          className="shrink-0 inline-flex items-center justify-center bg-blue-600 text-white text-sm font-medium px-4 py-2 min-h-[44px] hover:bg-blue-700 transition-colors"
        >
          {createOpen ? 'Annulla' : '+ Nuovo account'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-sm">
          {notice}
        </div>
      )}

      {createOpen && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Nuovo account</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                required autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password (min. 8 caratteri)</label>
              <input
                type="text" value={newPassword} onChange={e => setNewPass(e.target.value)}
                required minLength={8} autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            L&apos;account è subito attivo, senza email di conferma. La password è mostrata in chiaro
            per poterla trascrivere e consegnare: dopo il salvataggio non sarà più recuperabile.
          </p>
          <button
            type="submit" disabled={busy}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 min-h-[40px] hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center"
          >
            {busy ? <Spinner color="#fff" /> : 'Crea account'}
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ristoranti</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creato</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ultimo accesso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{u.email}</span>
                  {u.isSuperAdmin && (
                    <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 font-medium border bg-blue-50 text-blue-700 border-blue-200">
                      ACCOUNT PADRE
                    </span>
                  )}
                  {u.id === currentUserId && !u.isSuperAdmin && (
                    <span className="ml-2 text-[11px] text-gray-400">(tu)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{u.restaurants}</td>
                <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{formatDate(u.lastSignInAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setEditing(u); setEditEmail(u.email); setEditPass('')
                        setError(null); setNotice(null)
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Modifica
                    </button>
                    {!u.isSuperAdmin && u.id !== currentUserId && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={busy}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending && <p className="mt-3 text-xs text-gray-400">Aggiornamento…</p>}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleUpdate}
            className="w-full max-w-md bg-white border border-gray-200 p-5 space-y-3"
          >
            <p className="text-sm font-semibold text-gray-900">Modifica account</p>
            <p className="text-xs text-gray-500 break-all">{editing.email}</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                disabled={editing.isSuperAdmin}
                className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {editing.isSuperAdmin && (
                <p className="mt-1 text-[11px] text-gray-400">
                  L&apos;email dell&apos;account padre non è modificabile da qui.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nuova password <span className="font-normal text-gray-400">(vuoto = invariata)</span>
              </label>
              <input
                type="text" value={editPass} onChange={e => setEditPass(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit" disabled={busy}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 min-h-[40px] hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center"
              >
                {busy ? <Spinner color="#fff" /> : 'Salva'}
              </button>
              <button
                type="button" onClick={() => setEditing(null)}
                className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2 min-h-[40px] hover:bg-gray-50"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
