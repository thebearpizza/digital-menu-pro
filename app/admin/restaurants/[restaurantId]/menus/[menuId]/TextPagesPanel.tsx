'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { TextAlign } from '@tiptap/extension-text-align'
import { updateMenuExtraPages } from '../actions'
import type { MenuExtraPages, EmbeddedPageContent } from '../menuExtraPages'
import { Spinner } from '@/components/ui/Spinner'
import { SERIF_FONTS, SANS_FONTS, DISPLAY_FONTS, googleFontsUrl, customFontFaceCss, readableOn } from '@/lib/theme'

// ── Font catalogue ────────────────────────────────────────────────────────────

type FontOption = { label: string; value: string; css: string }

// PDF built-in fonts (no network load needed — always available in react-pdf)
const PDF_BUILTIN_FONTS: FontOption[] = [
  { label: 'Helvetica',       value: 'Helvetica',   css: 'Helvetica, Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times-Roman', css: '"Times New Roman", Times, serif' },
  { label: 'Courier',         value: 'Courier',     css: '"Courier New", Courier, monospace' },
]

// Curated Google fonts — same lists as the customization panel
const SERIF_FONT_OPTS:   FontOption[] = SERIF_FONTS.map(n   => ({ label: n, value: n, css: `'${n}', Georgia, serif` }))
const SANS_FONT_OPTS:    FontOption[] = SANS_FONTS.map(n    => ({ label: n, value: n, css: `'${n}', system-ui, sans-serif` }))
const DISPLAY_FONT_OPTS: FontOption[] = DISPLAY_FONTS.map(n => ({ label: n, value: n, css: `'${n}', sans-serif` }))

// Values of all known (non-custom) fonts, for detecting custom-font entries
const KNOWN_FONT_VALUES = new Set([
  ...PDF_BUILTIN_FONTS.map(f => f.value),
  ...SERIF_FONT_OPTS.map(f => f.value),
  ...SANS_FONT_OPTS.map(f => f.value),
  ...DISPLAY_FONT_OPTS.map(f => f.value),
])

const FONT_SIZES   = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36]
const LINE_HEIGHTS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.4]

function toHtml(body: string): string {
  if (!body) return ''
  if (body.trimStart().startsWith('<')) return body
  return body.split('\n').map(l =>
    l.trim() ? `<p>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<p></p>'
  ).join('')
}

// ── Rich text toolbar ─────────────────────────────────────────────────────────

interface ToolbarProps {
  editor:  Editor | null
  page:    EmbeddedPageContent
  fonts:   FontOption[]
  onChange: (page: EmbeddedPageContent) => void
}

function ToolbarBtn({
  active, title, width = 'w-8', onMouseDown, children,
}: {
  active: boolean
  title?: string
  width?: string
  onMouseDown: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className={`${width} h-8 text-sm border flex items-center justify-center transition-colors select-none
        ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
    >{children}</button>
  )
}

function RichToolbar({ editor, page, fonts, onChange }: ToolbarProps) {
  if (!editor) return null

  const currentFont = fonts.find(f => f.value === page.font) ?? fonts[0]
  const selColor = editor.getAttributes('textStyle').color as string | undefined

  // Extract custom-font options (anything not in the static lists)
  const customFontOpts = fonts.filter(f => !KNOWN_FONT_VALUES.has(f.value))

  return (
    <div className="bg-gray-50 border border-gray-200 p-2 flex flex-wrap items-center gap-1.5">

      {/* ── Block type ─────────────────────────────────────────────────── */}
      <div className="flex items-center border border-gray-300">
        <ToolbarBtn active={!editor.isActive('heading')} title="Paragrafo normale"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().setParagraph().run() }}>P</ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading',{level:1})} title="Titolo 1" width="w-9"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({level:1}).run() }}>H1</ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading',{level:2})} title="Titolo 2" width="w-9"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({level:2}).run() }}>H2</ToolbarBtn>
        <ToolbarBtn active={editor.isActive('heading',{level:3})} title="Titolo 3" width="w-9"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({level:3}).run() }}>H3</ToolbarBtn>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Inline marks ───────────────────────────────────────────────── */}
      <ToolbarBtn active={editor.isActive('bold')} title="Grassetto (Ctrl+B)"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}>
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} title="Corsivo (Ctrl+I)"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}>
        <span className="italic">I</span>
      </ToolbarBtn>

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Alignment ──────────────────────────────────────────────────── */}
      <div className="flex border border-gray-300">
        {([
          { a: 'left',   label: (
            <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor">
              <rect x="0" y="0"  width="14" height="1.8" rx="0.9"/>
              <rect x="0" y="4.6" width="10" height="1.8" rx="0.9"/>
              <rect x="0" y="9.2" width="12" height="1.8" rx="0.9"/>
            </svg>
          )},
          { a: 'center', label: (
            <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor">
              <rect x="0" y="0"  width="14" height="1.8" rx="0.9"/>
              <rect x="2" y="4.6" width="10" height="1.8" rx="0.9"/>
              <rect x="1" y="9.2" width="12" height="1.8" rx="0.9"/>
            </svg>
          )},
          { a: 'right',  label: (
            <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor">
              <rect x="0" y="0"  width="14" height="1.8" rx="0.9"/>
              <rect x="4" y="4.6" width="10" height="1.8" rx="0.9"/>
              <rect x="2" y="9.2" width="12" height="1.8" rx="0.9"/>
            </svg>
          )},
        ] as const).map(({ a, label }) => (
          <button
            key={a}
            type="button"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign(a).run() }}
            className={`w-8 h-8 flex items-center justify-center transition-colors
              ${editor.isActive({ textAlign: a }) ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >{label}</button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Selection color ────────────────────────────────────────────── */}
      <label className="flex items-center gap-1 cursor-pointer" title="Colore testo selezione">
        <span
          className="w-6 h-6 border border-gray-300 rounded-sm flex-shrink-0"
          style={{ backgroundColor: selColor ?? page.color }}
        />
        <input
          type="color"
          value={selColor ?? page.color}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          className="sr-only"
        />
        <span className="text-xs text-gray-500">Colore</span>
      </label>

      {selColor && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
          className="text-xs text-gray-400 hover:text-gray-700 px-1"
          title="Rimuovi colore personalizzato"
        >✕</button>
      )}

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Font family — grouped by category ──────────────────────────── */}
      <select
        value={page.font}
        onChange={e => onChange({ ...page, font: e.target.value })}
        className="text-sm border border-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[160px]"
        style={{ fontFamily: currentFont?.css }}
        title="Carattere base"
      >
        <optgroup label="PDF Built-in">
          {PDF_BUILTIN_FONTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </optgroup>
        <optgroup label="Serif">
          {SERIF_FONT_OPTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </optgroup>
        <optgroup label="Sans-serif">
          {SANS_FONT_OPTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </optgroup>
        <optgroup label="Display">
          {DISPLAY_FONT_OPTS.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </optgroup>
        {customFontOpts.length > 0 && (
          <optgroup label="Personalizzati">
            {customFontOpts.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
            ))}
          </optgroup>
        )}
      </select>

      <select
        value={page.fontSize}
        onChange={e => onChange({ ...page, fontSize: Number(e.target.value) })}
        className="text-sm border border-gray-300 px-2 py-1.5 w-[68px] focus:outline-none focus:border-blue-500"
        title="Dimensione testo base"
      >
        {FONT_SIZES.map(s => (
          <option key={s} value={s}>{s}pt</option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-xs text-gray-600" title="Interlinea">
        Interlinea
        <select
          value={page.lineHeight}
          onChange={e => onChange({ ...page, lineHeight: Number(e.target.value) })}
          className="text-sm border border-gray-300 px-1.5 py-1 w-[60px] focus:outline-none focus:border-blue-500"
        >
          {LINE_HEIGHTS.map(lh => (
            <option key={lh} value={lh}>{lh}×</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 cursor-pointer" title="Colore testo predefinito (tutta la pagina)">
        <span className="w-5 h-5 border border-gray-300 rounded-sm" style={{ backgroundColor: page.color }} />
        <input
          type="color"
          value={page.color}
          onChange={e => onChange({ ...page, color: e.target.value })}
          className="sr-only"
        />
        <span className="text-xs text-gray-400">Sfondo</span>
      </label>
    </div>
  )
}

// ── Single page editor ────────────────────────────────────────────────────────

// Il foglio dell'editor riproduce la pagina A4 del PDF del menu: stesse
// proporzioni, stessi margini (MenuPDFDocument → page padding), stesse
// dimensioni del testo in punti scalate alla larghezza del riquadro. Così si
// vede subito dove va a capo il testo e dove finisce la pagina.
export interface PaperSpec { bg: string; compact: boolean }
const DEFAULT_PAPER: PaperSpec = { bg: '#ffffff', compact: false }
const A4_W = 595.28, A4_H = 841.89


// ── Controllo reale "entra in una pagina?" ───────────────────────────────────
// Genera in sottofondo la pagina con lo stesso motore del PDF del menu e conta
// le pagine con pdf.js. Restituisce null se il controllo non è riuscito.
type FitResult = { pages: number; overflow: string } | null
let _pdfjsLoading: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  if (_pdfjsLoading) return _pdfjsLoading
  _pdfjsLoading = new Promise((resolve, reject) => {
    const w = window as any
    if (w.pdfjsLib) { resolve(w.pdfjsLib); return }
    const sc = document.createElement('script')
    sc.src = '/vendor/pdfjs/3.11.174/pdf.min.js'
    sc.onload = () => {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/3.11.174/pdf.worker.min.js'
      resolve(w.pdfjsLib)
    }
    sc.onerror = () => { _pdfjsLoading = null; reject(new Error('pdf.js')) }
    document.head.appendChild(sc)
  })
  return _pdfjsLoading
}
async function checkPageFit(page: EmbeddedPageContent, paper: PaperSpec, customFonts: Record<string, string>): Promise<FitResult> {
  try {
    const [{ createElement }, rp, { TextPageCheckDocument }, { registerThemeFonts }, lib] = await Promise.all([
      import('react'), import('@react-pdf/renderer'), import('@/app/m/[token]/MenuPDFDocument'), import('@/lib/pdfFonts'), loadPdfJs(),
    ])
    const registered = registerThemeFonts(rp.Font as any, [page.font], customFonts)
    const blob = await rp.pdf(createElement(TextPageCheckDocument, { page, bg: paper.bg, compact: paper.compact, registered }) as any).toBlob()
    const url = URL.createObjectURL(blob)
    try {
      const doc = await lib.getDocument(url).promise
      const pages = doc.numPages as number
      let overflow = ''
      if (pages > 1) {
        const tc = await (await doc.getPage(2)).getTextContent()
        overflow = tc.items.map((i: any) => i.str).join(' ').replace(/\s+/g, ' ').trim()
      }
      return { pages, overflow }
    } finally { URL.revokeObjectURL(url) }
  } catch (e) {
    console.error('checkPageFit', e)
    return null
  }
}

interface PageEditorProps {
  page:     EmbeddedPageContent
  fonts:    FontOption[]
  onChange: (page: EmbeddedPageContent) => void
  paper:    PaperSpec
  customFonts: Record<string, string>
}

function PageEditor({ page, fonts, onChange, paper, customFonts }: PageEditorProps) {
  // Controllo con il vero motore del PDF, ritardato mentre si scrive.
  const [fit, setFit] = useState<FitResult | 'checking'>('checking')
  const fitRun = useRef(0)
  useEffect(() => {
    const run = ++fitRun.current
    setFit('checking')
    const t = setTimeout(async () => {
      const r = await checkPageFit(page, paper, customFonts)
      if (run === fitRun.current) setFit(r)
    }, 700)
    return () => clearTimeout(t)
  }, [page.body, page.font, page.fontSize, page.lineHeight, page.bold, page.italic, page.align, paper.bg, paper.compact]) // eslint-disable-line react-hooks/exhaustive-deps

  const sheetRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / A4_W)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Margini della pagina PDF (MenuPDFDocument, stile `page`).
  const padTop    = paper.compact ? 38 : 52
  const padBottom = paper.compact ? 64 : 56
  const padSide   = paper.compact ? 44 : 54
  // Stesso limite del PDF (EmbeddedTextBlock).
  const ptSize    = Math.max(8, Math.min(36, page.fontSize))
  const currentFont = fonts.find(f => f.value === page.font) ?? fonts[0]

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false, blockquote: false, strike: false, horizontalRule: false }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: page.align }),
    ],
    content: toHtml(page.body),
    editorProps: {
      attributes: { class: 'dmp-rte-content', 'data-placeholder': 'Inizia a scrivere…' },
    },
    onUpdate: ({ editor: ed }) => {
      onChange({ ...page, body: ed.getHTML() })
    },
  })

  useEffect(() => () => { editor?.destroy() }, [editor])

  return (
    <div className="mt-3 flex flex-col gap-2">
      <RichToolbar editor={editor} page={page} fonts={fonts} onChange={onChange} />
      <div className="mx-auto w-full max-w-[520px]">
        <div
          ref={sheetRef}
          className="dmp-rte dmp-rte-page relative border border-gray-300 shadow-md cursor-text"
          style={{
            aspectRatio: `${A4_W} / ${A4_H}`,
            background:  paper.bg,
            fontFamily:  currentFont?.css,
            fontSize:    `${ptSize * scale}px`,
            color:       readableOn(page.color, paper.bg),
            lineHeight:  page.lineHeight,
            ['--pdf-s' as string]: scale,
            ['--pdf-pad' as string]: `${padTop * scale}px ${padSide * scale}px ${padBottom * scale}px`,
          }}
          onClick={() => editor?.commands.focus()}
        >
          {/* Fine dell'area utile della pagina: oltre questa linea il testo
              passa alla pagina successiva del menu. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-red-300"
            style={{ top: `${(A4_H - padBottom) * scale}px` }}>
            <span className="absolute right-1 -top-4 text-[9px] uppercase tracking-wider text-red-400">fine pagina</span>
          </div>
          <EditorContent editor={editor} />
        </div>
        {fit === 'checking' ? (
          <p className="mt-2 text-[11px] text-gray-400 text-center">Controllo dell&apos;impaginazione…</p>
        ) : fit === null ? (
          <p className="mt-2 text-[11px] text-gray-400 text-center">Anteprima indicativa: il testo oltre la linea rossa va alla pagina successiva.</p>
        ) : fit.pages <= 1 ? (
          <p className="mt-2 text-[11px] text-green-700 text-center">✓ Nel menu il testo entra in una pagina.</p>
        ) : (
          <p className="mt-2 text-[11px] text-red-600 text-center">
            Nel menu il testo occupa {fit.pages} pagine. Va alla pagina successiva: «{fit.overflow.length > 140 ? fit.overflow.slice(0, 140) + '…' : fit.overflow}»
          </p>
        )}
      </div>
    </div>
  )
}

// ── Collapsible section — defined OUTSIDE the panel to prevent remount ────────

interface SectionProps {
  label:        string
  page:         EmbeddedPageContent
  fonts:        FontOption[]
  onChangePage: (p: EmbeddedPageContent) => void
  isOpen:       boolean
  setIsOpen:    (v: boolean) => void
  paper:        PaperSpec
  customFonts:  Record<string, string>
}

function Section({ label, page, fonts, onChangePage, isOpen, setIsOpen, paper, customFonts }: SectionProps) {
  return (
    <div className="border border-gray-200 mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${page.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {page.enabled && (
            <span className="text-xs text-gray-400">
              • {page.position === 'first' ? 'prima delle portate' : 'dopo le portate'}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-5 border-t border-gray-100">
          <div className="flex items-center gap-5 mt-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => onChangePage({ ...page, enabled: !page.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer
                  ${page.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                  ${page.enabled ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-gray-700">{page.enabled ? 'Attiva' : 'Disattiva'}</span>
            </label>

            {page.enabled && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Posizione
                <select
                  value={page.position}
                  onChange={e => onChangePage({ ...page, position: e.target.value as 'first' | 'last' })}
                  className="text-sm border border-gray-300 px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  <option value="first">Prima delle portate</option>
                  <option value="last">Dopo le portate</option>
                </select>
              </label>
            )}
          </div>

          {page.enabled && (
            <PageEditor page={page} fonts={fonts} onChange={onChangePage} paper={paper} customFonts={customFonts} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel (two pages: Info + Allergeni) ───────────────────────────────────────

interface Props {
  restaurantId: string
  menuId:       string
  initialPages: MenuExtraPages
  customFonts?: Record<string, string>
  paper?:       PaperSpec
}

export default function TextPagesPanel({ restaurantId, menuId, initialPages, customFonts, paper = DEFAULT_PAPER }: Props) {
  const [pages,    setPages]    = useState<MenuExtraPages>(initialPages)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [algOpen,  setAlgOpen]  = useState(false)

  // Build font list: curated Google fonts + uploaded custom fonts
  const customFontOpts = useMemo<FontOption[]>(() =>
    Object.keys(customFonts ?? {}).map(n => ({ label: n, value: n, css: `'${n}', sans-serif` })),
  [customFonts])

  const allFonts = useMemo<FontOption[]>(() => [
    ...PDF_BUILTIN_FONTS,
    ...SERIF_FONT_OPTS,
    ...SANS_FONT_OPTS,
    ...DISPLAY_FONT_OPTS,
    ...customFontOpts,
  ], [customFontOpts])

  // Load all curated Google fonts + custom @font-face for the editor preview
  useEffect(() => {
    const url = googleFontsUrl([...SERIF_FONTS, ...SANS_FONTS, ...DISPLAY_FONTS])
    let link: HTMLLinkElement | null = null
    if (url) {
      link = document.createElement('link')
      link.rel  = 'stylesheet'
      link.href = url
      document.head.appendChild(link)
    }
    let styleEl: HTMLStyleElement | null = null
    const customCss = customFonts && Object.keys(customFonts).length > 0
      ? customFontFaceCss(customFonts)
      : ''
    if (customCss) {
      styleEl = document.createElement('style')
      styleEl.textContent = customCss
      document.head.appendChild(styleEl)
    }
    return () => {
      if (link)    document.head.removeChild(link)
      if (styleEl) document.head.removeChild(styleEl)
    }
  }, [customFonts]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateInfo     = useCallback((info:     EmbeddedPageContent) => { setPages(p => ({...p, info}));     setSaved(false) }, [])
  const updateAllergen = useCallback((allergen: EmbeddedPageContent) => { setPages(p => ({...p, allergen})); setSaved(false) }, [])

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
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[80px] flex items-center justify-center gap-2"
          >
            {saving ? <Spinner color="#fff" /> : 'Salva'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-5">
        Le pagine aggiuntive vengono inserite nel PDF del menu (prima o dopo le portate).
        Usa <kbd className="bg-gray-100 px-1 rounded text-gray-600">Ctrl+B</kbd> per il grassetto,
        {' '}<kbd className="bg-gray-100 px-1 rounded text-gray-600">Ctrl+I</kbd> per il corsivo.
      </p>

      <Section
        label="Pagina informativa"
        page={pages.info}
        fonts={allFonts}
        onChangePage={updateInfo}
        isOpen={infoOpen}
        setIsOpen={setInfoOpen}
        paper={paper}
        customFonts={customFonts ?? {}}
      />
      <Section
        label="Pagina allergeni"
        page={pages.allergen}
        fonts={allFonts}
        onChangePage={updateAllergen}
        isOpen={algOpen}
        setIsOpen={setAlgOpen}
        paper={paper}
        customFonts={customFonts ?? {}}
      />
    </div>
  )
}
