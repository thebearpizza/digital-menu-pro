'use client'
// ─────────────────────────────────────────────────────────────────────────────
// ExcelImportExport — modulo Excel scaricabile + ricarica compilato.
// "Scarica modulo" apre un dropdown: template vuoto oppure piatti attuali.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { ALLERGENS } from '@/lib/allergens'
import { Spinner } from '@/components/ui/Spinner'
import { bulkCreateDishes } from './actions'

const HEADERS = [
  'Nome *',
  'Categoria *',
  'Prezzo (€)',
  'Descrizione',
  'Allergeni (numeri separati da virgola)',
  'URL immagine',
  'Abbinamento (nome piatto)',
  'Visibile (SI/NO)',
] as const

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  allergens: number[]
  is_active: boolean
  pairing_dish_id: string | null
  pairing_label: string | null
}

interface Props {
  restaurantId: string
  menuId: string
  dishes: Dish[]
  onImported: (created: any[]) => void
}

function buildLegendSheet() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Legenda allergeni (usa i numeri nella colonna "Allergeni")'],
    [],
    ['Numero', 'Allergene'],
    ...ALLERGENS.map(a => [a.id, a.name]),
    [],
    ['Note:'],
    ['- Nome e Categoria sono obbligatori; gli altri campi sono facoltativi.'],
    ['- Prezzo: numero con punto o virgola (es. 12,50).'],
    ['- Visibile: SI per mostrare il piatto nel menu, NO per nasconderlo (default SI).'],
    ['- Abbinamento: il nome esatto di un altro piatto del menu (anche dello stesso file).'],
  ])
  ws['!cols'] = [{ wch: 10 }, { wch: 60 }]
  return ws
}

function colWidths() {
  return [{ wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 44 }, { wch: 32 }, { wch: 28 }, { wch: 26 }, { wch: 14 }]
}

export default function ExcelImportExport({ restaurantId, menuId, dishes, onImported }: Props) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const btnRef     = useRef<HTMLButtonElement>(null)
  const [importing, setImporting] = useState(false)
  const [dropOpen,  setDropOpen]  = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function onOut(e: MouseEvent) {
      const t = e.target as Node
      if (dropRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setDropOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [dropOpen])

  function downloadEmpty() {
    setDropOpen(false)
    const wb = XLSX.utils.book_new()
    const example = [
      'Spaghetti alla carbonara', 'Primi', 12.5,
      'Guanciale croccante, pecorino romano e pepe nero',
      '1, 3, 7', '', 'Vino della casa', 'SI',
    ]
    const ws = XLSX.utils.aoa_to_sheet([HEADERS as unknown as string[], example])
    ws['!cols'] = colWidths()
    XLSX.utils.book_append_sheet(wb, ws, 'Piatti')
    XLSX.utils.book_append_sheet(wb, buildLegendSheet(), 'Istruzioni')
    XLSX.writeFile(wb, 'modulo-piatti-vuoto.xlsx')
  }

  function downloadWithDishes() {
    setDropOpen(false)
    const wb = XLSX.utils.book_new()
    // Find pairing name from the same dish list
    const rows = dishes.map(d => {
      const pairingName = d.pairing_dish_id
        ? (dishes.find(x => x.id === d.pairing_dish_id)?.name ?? '')
        : ''
      return [
        d.name,
        d.category ?? '',
        d.price ?? '',
        d.description ?? '',
        d.allergens.join(', '),
        d.image_url ?? '',
        pairingName,
        d.is_active ? 'SI' : 'NO',
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([HEADERS as unknown as string[], ...rows])
    ws['!cols'] = colWidths()
    XLSX.utils.book_append_sheet(wb, ws, 'Piatti')
    XLSX.utils.book_append_sheet(wb, buildLegendSheet(), 'Istruzioni')
    XLSX.writeFile(wb, 'modulo-piatti-attuali.xlsx')
  }

  async function handleFile(file: File) {
    setImporting(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets['Piatti'] ?? wb.Sheets[wb.SheetNames[0]]
      if (!ws) { alert('File non leggibile: nessun foglio trovato.'); return }
      const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const dataRows = grid.slice(1).filter(r => String(r[0] ?? '').trim() !== '')
      if (!dataRows.length) { alert('Nessun piatto trovato nel file (la colonna Nome è vuota).'); return }

      const errors: string[] = []
      const rows = dataRows.map((r, i) => {
        const rowN = i + 2
        const name     = String(r[0] ?? '').trim()
        const category = String(r[1] ?? '').trim()
        if (!category) errors.push(`Riga ${rowN}: categoria mancante.`)
        const rawPrice = String(r[2] ?? '').trim().replace(',', '.').replace('€', '').trim()
        let price: number | null = null
        if (rawPrice !== '') {
          const p = parseFloat(rawPrice)
          if (isNaN(p) || p < 0) errors.push(`Riga ${rowN}: prezzo non valido ("${r[2]}").`)
          else price = p
        }
        const allergens = String(r[4] ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(Number)
        if (allergens.some(a => isNaN(a) || a < 1 || a > 14)) {
          errors.push(`Riga ${rowN}: allergeni non validi ("${r[4]}") — usa i numeri 1–14.`)
        }
        const vis = String(r[7] ?? '').trim().toLowerCase()
        return {
          name,
          category,
          price,
          description:  String(r[3] ?? '').trim() || null,
          allergens:    allergens.filter(a => !isNaN(a)),
          image_url:    String(r[5] ?? '').trim() || null,
          pairing_name: String(r[6] ?? '').trim() || null,
          is_active:    vis === '' || vis === 'si' || vis === 'sì' || vis === 'yes',
        }
      })

      if (errors.length) {
        alert(`Il file contiene errori, nessun piatto importato:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n…e altri ${errors.length - 10} errori.` : ''}`)
        return
      }

      const created = await bulkCreateDishes(restaurantId, menuId, rows)
      onImported(created)
      alert(`${created.length} ${created.length === 1 ? 'piatto importato' : 'piatti importati'} con successo.`)
    } catch (e: any) {
      alert(`Errore durante l'import: ${e?.message ?? 'file non leggibile'}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      {/* Scarica modulo — dropdown a due voci */}
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setDropOpen(o => !o)}
          className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          Scarica modulo
        </button>

        {dropOpen && (
          <div
            ref={dropRef}
            className="absolute left-0 right-0 top-full mt-0.5 z-50 bg-white border border-gray-200 shadow-lg"
          >
            <button
              type="button"
              onClick={downloadEmpty}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Template vuoto
              <span className="block text-[10px] text-gray-400 mt-0.5 leading-tight">Con riga di esempio</span>
            </button>
            <div className="h-px bg-gray-100" />
            <button
              type="button"
              onClick={downloadWithDishes}
              disabled={dishes.length === 0}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Piatti attuali ({dishes.length})
              <span className="block text-[10px] text-gray-400 mt-0.5 leading-tight">Esporta i piatti del menu</span>
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={importing}
        onClick={() => fileRef.current?.click()}
        className="w-full border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center"
      >
        {importing ? <Spinner color="#374151" /> : 'Importa modulo'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </>
  )
}
