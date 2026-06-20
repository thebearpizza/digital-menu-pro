'use client'

import { useState, useEffect } from 'react'
import { updateMenuExtraPages } from '../actions'
import type { MenuExtraPages, EmbeddedPageContent } from '../menuExtraPages'
import { Spinner } from '@/components/ui/Spinner'

const TEXT_FONTS: { label: string; value: string; css: string }[] = [
  { label: 'Helvetica',          value: 'Helvetica',          css: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman',    value: 'Times-Roman',        css: '"Times New Roman", Times, serif' },
  { label: 'Courier',            value: 'Courier',            css: '"Courier New", Courier, monospace' },
  { label: 'Cormorant Garamond', value: 'Cormorant Garamond', css: '"Cormorant Garamond", serif' },
  { label: 'Lato',               value: 'Lato',               css: 'Lato, sans-serif' },
  { label: 'Merriweather',       value: 'Merriweather',       css: 'Merriweather, serif' },
  { label: 'Montserrat',         value: 'Montserrat',         css: 'Montserrat, sans-serif' },
  { label: 'Open Sans',          value: 'Open Sans',          css: '"Open Sans", sans-serif' },
  { label: 'Playfair Display',   value: 'Playfair Display',   css: '"Playfair Display", serif' },
  { label: 'Raleway',            value: 'Raleway',            css: 'Raleway, sans-serif' },
  { label: 'Roboto',             value: 'Roboto',             css: 'Roboto, sans-serif' },
]

const GOOGLE_FONT_NAMES = TEXT_FONTS
  .filter(f => !['Helvetica', 'Times-Roman', 'Courier'].includes(f.value))
  .map(f => f.value)
  .join('&family=')

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36]
const LINE_HEIGHTS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.4]

interface PageEditorProps {
  page: EmbeddedPageContent
  onChange: (page: EmbeddedPageContent) => void
}

function PageEditor({ page, onChange }: PageEditorProps) {
  const currentFont = TEXT_FONTS.find(f => f.value === page.font) ?? TEXT_FONTS[0]

  function set<K extends keyof EmbeddedPageContent>(key: K, val: EmbeddedPageContent[K]) {
    onChange({ ...page, [key]: val })
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* Toolbar */}
      <div className="bg-gray-50 border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        {/* Font family */}
        <select
          value={page.font}
          onChange={e => set('font', e.target.value)}
          className="text-sm border border-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[160px]"
          style={{ fontFamily: currentFont.css }}
        >
          {TEXT_FONTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          value={page.fontSize}
          onChange={e => set('fontSize', Number(e.target.value))}
          className="text-sm border border-gray-300 px-2 py-1.5 w-[68px] focus:outline-none focus:border-blue-500"
        >
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>

        {/* Bold */}
        <button
          onClick={() => set('bold', !page.bold)}
          className={`w-8 h-8 font-bold text-sm border flex items-center justify-center transition-colors ${page.bold ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
          title="Grassetto"
        >B</button>

        {/* Italic */}
        <button
          onClick={() => set('italic', !page.italic)}
          className={`w-8 h-8 italic text-sm border flex items-center justify-center transition-colors ${page.italic ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
          title="Corsivo"
        >I</button>

        {/* Alignment */}
        <div className="flex border border-gray-300">
          {([
            { a: 'left' as const,   label: 'Sinistra', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="0" y="5"  width="10" height="2" rx="1"/>
                <rect x="0" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
            { a: 'center' as const, label: 'Centro', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="2" y="5"  width="10" height="2" rx="1"/>
                <rect x="1" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
            { a: 'right' as const,  label: 'Destra', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="4" y="5"  width="10" height="2" rx="1"/>
                <rect x="2" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
          ]).map(({ a, label, icon }) => (
            <button
              key={a}
              onClick={() => set('align', a)}
              title={label}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${page.align === a ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >{icon}</button>
          ))}
        </div>

        {/* Color */}
        <label className="flex items-center gap-1.5 cursor-pointer" title="Colore testo">
          <span className="w-6 h-6 border border-gray-300 rounded-sm" style={{ backgroundColor: page.color }} />
          <input
            type="color"
            value={page.color}
            onChange={e => set('color', e.target.value)}
            className="sr-only"
          />
          <span className="text-xs text-gray-500">Colore</span>
        </label>

        {/* Line height */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Interlinea
          <select
            value={page.lineHeight}
            onChange={e => set('lineHeight', Number(e.target.value))}
            className="text-sm border border-gray-300 px-1.5 py-1 w-[64px] focus:outline-none focus:border-blue-500"
          >
            {LINE_HEIGHTS.map(lh => (
              <option key={lh} value={lh}>{lh}×</option>
            ))}
          </select>
        </label>
      </div>

      {/* Textarea */}
      <textarea
        value={page.body}
        onChange={e => set('body', e.target.value)}
        placeholder="Inizia a scrivere il contenuto della pagina…"
        className="w-full resize-y focus:outline-none focus:ring-1 focus:ring-blue-300 border border-gray-200 p-4 min-h-[220px] leading-relaxed text-sm"
        style={{
          fontFamily:  currentFont.css,
          fontSize:    `${page.fontSize}px`,
          textAlign:   page.align,
          color:       page.color,
          fontWeight:  page.bold   ? 700  : 400,
          fontStyle:   page.italic ? 'italic' : 'normal',
          lineHeight:  page.lineHeight,
        }}
      />
    </div>
  )
}

interface Props {
  restaurantId: string
  menuId:       string
  initialPages: MenuExtraPages
}

export default function TextPagesPanel({ restaurantId, menuId, initialPages }: Props) {
  const [pages,   setPages]   = useState<MenuExtraPages>(initialPages)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [infoOpen, setInfoOpen]   = useState(false)
  const [algOpen,  setAlgOpen]    = useState(false)

  // Load Google Fonts for the textarea preview
  useEffect(() => {
    const famParam = encodeURIComponent(GOOGLE_FONT_NAMES)
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${famParam.replace(/%20/g, '+').replace(/%26family%3D/g, '&family=')}&display=swap`
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  function updateInfo(info: EmbeddedPageContent) {
    setPages(p => ({ ...p, info }))
    setSaved(false)
  }

  function updateAllergen(allergen: EmbeddedPageContent) {
    setPages(p => ({ ...p, allergen }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await updateMenuExtraPages(restaurantId, menuId, pages)
      setSaved(true)
    } catch (e: any) {
      setError(e?.message ?? 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pagine aggiuntive</h2>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-500">{error}</span>}
          {saved && !error && <span className="text-xs text-green-600">Salvato</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[80px] flex items-center justify-center gap-2"
          >
            {saving ? <Spinner color="#fff" /> : 'Salva'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-5">
        Le pagine aggiuntive vengono inserite nel PDF del menu (prima o dopo le portate)
        ma non sono selezionabili dalla landing page del ristorante.
      </p>

      {/* ── Info page ──────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 mb-3">
        <button
          onClick={() => setInfoOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${pages.info.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium text-gray-800">Pagina informativa</span>
            {pages.info.enabled && (
              <span className="text-xs text-gray-400">
                • {pages.info.position === 'first' ? 'prima delle portate' : 'dopo le portate'}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {infoOpen && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="flex items-center gap-6 mt-3">
              {/* Enabled toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => updateInfo({ ...pages.info, enabled: !pages.info.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${pages.info.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pages.info.enabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">{pages.info.enabled ? 'Attiva' : 'Disattiva'}</span>
              </label>

              {/* Position */}
              {pages.info.enabled && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  Posizione
                  <select
                    value={pages.info.position}
                    onChange={e => updateInfo({ ...pages.info, position: e.target.value as 'first' | 'last' })}
                    className="text-sm border border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                  >
                    <option value="first">Prima delle portate</option>
                    <option value="last">Dopo le portate</option>
                  </select>
                </label>
              )}
            </div>

            {pages.info.enabled && (
              <PageEditor page={pages.info} onChange={updateInfo} />
            )}
          </div>
        )}
      </div>

      {/* ── Allergen page ──────────────────────────────────────────────────── */}
      <div className="border border-gray-200">
        <button
          onClick={() => setAlgOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${pages.allergen.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium text-gray-800">Pagina allergeni</span>
            {pages.allergen.enabled && (
              <span className="text-xs text-gray-400">
                • {pages.allergen.position === 'first' ? 'prima delle portate' : 'dopo le portate'}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${algOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {algOpen && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="flex items-center gap-6 mt-3">
              {/* Enabled toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => updateAllergen({ ...pages.allergen, enabled: !pages.allergen.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${pages.allergen.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pages.allergen.enabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">{pages.allergen.enabled ? 'Attiva' : 'Disattiva'}</span>
              </label>

              {/* Position */}
              {pages.allergen.enabled && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  Posizione
                  <select
                    value={pages.allergen.position}
                    onChange={e => updateAllergen({ ...pages.allergen, position: e.target.value as 'first' | 'last' })}
                    className="text-sm border border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                  >
                    <option value="first">Prima delle portate</option>
                    <option value="last">Dopo le portate</option>
                  </select>
                </label>
              )}
            </div>

            {pages.allergen.enabled && (
              <PageEditor page={pages.allergen} onChange={updateAllergen} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
