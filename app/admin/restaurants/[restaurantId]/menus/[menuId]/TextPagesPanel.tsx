'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { TextAlign } from '@tiptap/extension-text-align'
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
  .map(f => f.value).join('&family=')

const FONT_SIZES  = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36]
const LINE_HEIGHTS= [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.4]

// Convert legacy plain-text body to HTML (Tiptap expects HTML)
function toHtml(body: string): string {
  if (!body) return ''
  if (body.trimStart().startsWith('<')) return body
  // Plain text → wrap each line in <p>
  return body.split('\n').map(l =>
    l.trim() ? `<p>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<p></p>'
  ).join('')
}

// ── Rich text toolbar ─────────────────────────────────────────────────────────

import type { Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor | null
  page: EmbeddedPageContent
  onChange: (page: EmbeddedPageContent) => void
}

function RichToolbar({ editor, page, onChange }: ToolbarProps) {
  if (!editor) return null

  const currentFont = TEXT_FONTS.find(f => f.value === page.font) ?? TEXT_FONTS[0]

  // Current inline color (from selection or cursor)
  const selColor = editor.getAttributes('textStyle').color as string | undefined

  function btn(
    label: React.ReactNode,
    active: boolean,
    onClick: () => void,
    title?: string,
    width = 'w-8',
  ) {
    return (
      <button
        key={title ?? String(label)}
        onMouseDown={e => { e.preventDefault(); onClick() }}
        title={title}
        className={`${width} h-8 text-sm border flex items-center justify-center transition-colors select-none
          ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
      >{label}</button>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 p-2 flex flex-wrap items-center gap-1.5">

      {/* ── Block type ─────────────────────────────────────────────────── */}
      <div className="flex items-center border border-gray-300">
        {btn('P',  !editor.isActive('heading'), () => editor.chain().focus().setParagraph().run(), 'Paragrafo normale')}
        {btn('H1', editor.isActive('heading',{level:1}), () => editor.chain().focus().toggleHeading({level:1}).run(), 'Titolo 1', 'w-9')}
        {btn('H2', editor.isActive('heading',{level:2}), () => editor.chain().focus().toggleHeading({level:2}).run(), 'Titolo 2', 'w-9')}
        {btn('H3', editor.isActive('heading',{level:3}), () => editor.chain().focus().toggleHeading({level:3}).run(), 'Titolo 3', 'w-9')}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Inline marks ───────────────────────────────────────────────── */}
      {btn(<span className="font-bold">B</span>,  editor.isActive('bold'),   () => editor.chain().focus().toggleBold().run(),   'Grassetto (Ctrl+B)')}
      {btn(<span className="italic">I</span>,     editor.isActive('italic'),  () => editor.chain().focus().toggleItalic().run(), 'Corsivo (Ctrl+I)')}

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

      {/* Unset color (restore default) */}
      {selColor && (
        <button
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
          className="text-xs text-gray-400 hover:text-gray-700 px-1"
          title="Rimuovi colore personalizzato"
        >✕</button>
      )}

      <div className="w-px h-6 bg-gray-300" />

      {/* ── Page-level defaults ─────────────────────────────────────────── */}
      <select
        value={page.font}
        onChange={e => onChange({ ...page, font: e.target.value })}
        className="text-sm border border-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[140px]"
        style={{ fontFamily: currentFont.css }}
        title="Carattere base"
      >
        {TEXT_FONTS.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
        ))}
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

      {/* Default text color (whole page) */}
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

interface PageEditorProps {
  page:     EmbeddedPageContent
  onChange: (page: EmbeddedPageContent) => void
}

function PageEditor({ page, onChange }: PageEditorProps) {
  const currentFont = TEXT_FONTS.find(f => f.value === page.font) ?? TEXT_FONTS[0]

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

  // Destroy editor on unmount
  useEffect(() => () => { editor?.destroy() }, [editor])

  return (
    <div className="mt-3 flex flex-col gap-2">
      <RichToolbar editor={editor} page={page} onChange={onChange} />
      <div
        className="dmp-rte border border-gray-200 bg-white cursor-text"
        style={{
          fontFamily:  currentFont.css,
          fontSize:    `${page.fontSize}px`,
          color:       page.color,
          lineHeight:  page.lineHeight,
        }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

// ── Panel (two pages: Info + Allergeni) ───────────────────────────────────────

interface Props {
  restaurantId: string
  menuId:       string
  initialPages: MenuExtraPages
}

export default function TextPagesPanel({ restaurantId, menuId, initialPages }: Props) {
  const [pages,    setPages]    = useState<MenuExtraPages>(initialPages)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [algOpen,  setAlgOpen]  = useState(false)

  // Load Google Fonts for editor preview
  useEffect(() => {
    const famParam = encodeURIComponent(GOOGLE_FONT_NAMES)
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${famParam.replace(/%20/g, '+').replace(/%26family%3D/g, '&family=')}&display=swap`
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

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

  function Section({
    label, page, onChangePage, isOpen, setIsOpen,
  }: {
    label: string
    page: EmbeddedPageContent
    onChangePage: (p: EmbeddedPageContent) => void
    isOpen: boolean
    setIsOpen: (v: boolean) => void
  }) {
    return (
      <div className="border border-gray-200 mb-3">
        <button
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
              <PageEditor page={page} onChange={onChangePage} />
            )}
          </div>
        )}
      </div>
    )
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
        Le pagine aggiuntive vengono inserite nel PDF del menu (prima o dopo le portate).
        Usa <kbd className="bg-gray-100 px-1 rounded text-gray-600">Ctrl+B</kbd> per il grassetto,
        {' '}<kbd className="bg-gray-100 px-1 rounded text-gray-600">Ctrl+I</kbd> per il corsivo.
      </p>

      <Section
        label="Pagina informativa"
        page={pages.info}
        onChangePage={updateInfo}
        isOpen={infoOpen}
        setIsOpen={setInfoOpen}
      />
      <Section
        label="Pagina allergeni"
        page={pages.allergen}
        onChangePage={updateAllergen}
        isOpen={algOpen}
        setIsOpen={setAlgOpen}
      />
    </div>
  )
}
