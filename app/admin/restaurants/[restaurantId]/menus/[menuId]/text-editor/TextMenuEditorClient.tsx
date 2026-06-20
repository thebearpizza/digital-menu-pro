'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { updateTextContent } from '../../actions'
import { Spinner } from '@/components/ui/Spinner'

// ── Fonts available for text menu pages ───────────────────────────────────────
// Values must match @react-pdf/renderer font registration keys (pdfFonts.ts).
// Built-in PDF fonts (Helvetica / Times-Roman / Courier) need no registration.
const TEXT_FONTS: { label: string; value: string; css: string }[] = [
  { label: 'Helvetica',         value: 'Helvetica',          css: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman',   value: 'Times-Roman',        css: '"Times New Roman", Times, serif' },
  { label: 'Courier',           value: 'Courier',            css: '"Courier New", Courier, monospace' },
  { label: 'Cormorant Garamond',value: 'Cormorant Garamond', css: '"Cormorant Garamond", serif' },
  { label: 'Lato',              value: 'Lato',               css: 'Lato, sans-serif' },
  { label: 'Merriweather',      value: 'Merriweather',       css: 'Merriweather, serif' },
  { label: 'Montserrat',        value: 'Montserrat',         css: 'Montserrat, sans-serif' },
  { label: 'Open Sans',         value: 'Open Sans',          css: '"Open Sans", sans-serif' },
  { label: 'Playfair Display',  value: 'Playfair Display',   css: '"Playfair Display", serif' },
  { label: 'Raleway',           value: 'Raleway',            css: 'Raleway, sans-serif' },
  { label: 'Roboto',            value: 'Roboto',             css: 'Roboto, sans-serif' },
]

const GOOGLE_FONT_NAMES = TEXT_FONTS
  .filter(f => !['Helvetica', 'Times-Roman', 'Courier'].includes(f.value))
  .map(f => f.value)
  .join('&family=')

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36]
const LINE_HEIGHTS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.4]

export interface TextContent {
  body: string
  font?: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  color?: string
  bold?: boolean
  italic?: boolean
  lineHeight?: number
}

interface Props {
  restaurantId: string
  menuId: string
  menuName: string
  initialContent: TextContent | null
}

export default function TextMenuEditorClient({ restaurantId, menuId, menuName: _menuName, initialContent }: Props) {
  const [body,       setBody]       = useState(initialContent?.body ?? '')
  const [font,       setFont]       = useState(initialContent?.font ?? 'Helvetica')
  const [fontSize,   setFontSize]   = useState(initialContent?.fontSize ?? 12)
  const [align,      setAlign]      = useState<'left' | 'center' | 'right'>(initialContent?.align ?? 'left')
  const [color,      setColor]      = useState(initialContent?.color ?? '#1a1a1a')
  const [bold,       setBold]       = useState(initialContent?.bold ?? false)
  const [italic,     setItalic]     = useState(initialContent?.italic ?? false)
  const [lineHeight, setLineHeight] = useState(initialContent?.lineHeight ?? 1.6)

  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const dirty = useRef(false)

  // Mark dirty whenever content changes
  useEffect(() => { dirty.current = true; setSaved(false) }, [body, font, fontSize, align, color, bold, italic, lineHeight])

  // Load Google Fonts for preview
  useEffect(() => {
    const famParam = encodeURIComponent(GOOGLE_FONT_NAMES)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${famParam.replace(/%20/g, '+').replace(/%26family%3D/g, '&family=')}&display=swap`
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const currentFont = TEXT_FONTS.find(f => f.value === font) ?? TEXT_FONTS[0]

  const buildContent = useCallback((): TextContent => ({
    body, font, fontSize, align, color, bold, italic, lineHeight,
  }), [body, font, fontSize, align, color, bold, italic, lineHeight])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await updateTextContent(restaurantId, menuId, buildContent())
      setSaved(true); dirty.current = false
    } catch (e: any) {
      setError(e?.message ?? 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">

      {/* ── Formatting toolbar ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 p-3 flex flex-wrap items-center gap-3">

        {/* Font family */}
        <select
          value={font}
          onChange={e => setFont(e.target.value)}
          className="text-sm border border-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[170px]"
          style={{ fontFamily: currentFont.css }}
        >
          {TEXT_FONTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          value={fontSize}
          onChange={e => setFontSize(Number(e.target.value))}
          className="text-sm border border-gray-300 px-2 py-1.5 w-[70px] focus:outline-none focus:border-blue-500"
        >
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>

        {/* Bold */}
        <button
          onClick={() => setBold(b => !b)}
          className={`w-8 h-8 font-bold text-sm border flex items-center justify-center transition-colors ${bold ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
          title="Grassetto"
        >B</button>

        {/* Italic */}
        <button
          onClick={() => setItalic(i => !i)}
          className={`w-8 h-8 italic text-sm border flex items-center justify-center transition-colors ${italic ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
          title="Corsivo"
        >I</button>

        {/* Alignment */}
        <div className="flex border border-gray-300">
          {([
            { a: 'left',   label: 'Sinistra', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="0" y="5"  width="10" height="2" rx="1"/>
                <rect x="0" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
            { a: 'center', label: 'Centro', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="2" y="5"  width="10" height="2" rx="1"/>
                <rect x="1" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
            { a: 'right',  label: 'Destra', icon: (
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0"  width="14" height="2" rx="1"/>
                <rect x="4" y="5"  width="10" height="2" rx="1"/>
                <rect x="2" y="10" width="12" height="2" rx="1"/>
              </svg>
            )},
          ] as const).map(({ a, label, icon }) => (
            <button
              key={a}
              onClick={() => setAlign(a)}
              title={label}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${align === a ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Color */}
        <label className="flex items-center gap-1.5 cursor-pointer" title="Colore testo">
          <span
            className="w-6 h-6 border border-gray-300 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="sr-only"
          />
          <span className="text-xs text-gray-500">Colore</span>
        </label>

        {/* Line height */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Interlinea
          <select
            value={lineHeight}
            onChange={e => setLineHeight(Number(e.target.value))}
            className="text-sm border border-gray-300 px-1.5 py-1 w-[64px] focus:outline-none focus:border-blue-500"
          >
            {LINE_HEIGHTS.map(lh => (
              <option key={lh} value={lh}>{lh}×</option>
            ))}
          </select>
        </label>

        {/* Spacer + Save */}
        <div className="ml-auto flex items-center gap-3">
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

      {/* ── Textarea ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 p-1">
        {/* A4-like proportional preview area */}
        <textarea
          value={body}
          onChange={e => { setBody(e.target.value); setSaved(false) }}
          placeholder="Inizia a scrivere il contenuto della pagina…"
          className="w-full resize-none focus:outline-none p-6 min-h-[600px] leading-relaxed"
          style={{
            fontFamily:  currentFont.css,
            fontSize:    `${fontSize}px`,
            textAlign:   align,
            color:       color,
            fontWeight:  bold   ? 700 : 400,
            fontStyle:   italic ? 'italic' : 'normal',
            lineHeight:  lineHeight,
          }}
        />
      </div>

      {/* ── Hint ───────────────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400">
        Il testo viene convertito in pagina PDF all&apos;interno del flipbook del menu pubblico.
        Usa Ctrl+S / Cmd+S per salvare rapidamente.
      </p>
    </div>
  )
}
