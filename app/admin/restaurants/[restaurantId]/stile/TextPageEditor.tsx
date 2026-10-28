'use client'
// Testo della pagina informativa, con i soli formati che la pagina usa
// davvero: titolo, sottotitolo, testo piccolo, paragrafo, grassetto, corsivo,
// allineamento (caratteri e misure si scelgono negli stili accanto).

import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TextAlign } from '@tiptap/extension-text-align'

/** Testo semplice (vecchie pagine) → paragrafi HTML. */
export function toHtml(body: string): string {
  if (!body) return ''
  if (body.trimStart().startsWith('<')) return body
  return body.split('\n').map(l =>
    l.trim() ? `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<p></p>',
  ).join('')
}

export default function TextPageEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, bulletList: false, orderedList: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: toHtml(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,   // i tasti seguono la selezione
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: { attributes: { class: 'lito-textpage min-h-[180px] px-3 py-2 text-sm text-gray-800 outline-none' } },
  })
  // Testo cambiato da fuori (altro menu, "Annulla"): l'editor si allinea.
  useEffect(() => {
    if (!editor) return
    const html = toHtml(value)
    if (html !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(html, { emitUpdate: false })
  }, [value, editor])

  return (
    <div className="border border-gray-200 bg-white" style={{ borderRadius: 12 }}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style>{`
        .lito-textpage h1 { font-size: 1.35em; font-weight: 600; margin: .4em 0 .2em }
        .lito-textpage h2 { font-size: 1.15em; font-weight: 600; margin: .4em 0 .2em }
        .lito-textpage h3 { font-size: .95em; font-style: italic; color: #6b7280; margin: .3em 0 .1em }
        .lito-textpage p { margin: .25em 0 }
      `}</style>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-10 border-b border-gray-100" />
  const btn = (label: string, active: boolean, run: () => void, title: string, style?: React.CSSProperties) => (
    <button type="button" title={title} aria-label={title} aria-pressed={active}
      onMouseDown={e => { e.preventDefault(); run() }}
      className={`h-8 min-w-8 px-2 text-xs border transition ${active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
      style={{ borderRadius: 8, ...style }}>
      {label}
    </button>
  )
  const c = () => editor.chain().focus()
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 p-1.5">
      {btn('Titolo', editor.isActive('heading', { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), 'Titolo')}
      {btn('Sottotitolo', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), 'Sottotitolo')}
      {btn('Piccolo', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), 'Testo piccolo in corsivo')}
      {btn('Testo', editor.isActive('paragraph'), () => c().setParagraph().run(), 'Paragrafo')}
      <span className="mx-1 h-5 w-px bg-gray-200" />
      {btn('G', editor.isActive('bold'), () => c().toggleBold().run(), 'Grassetto', { fontWeight: 700 })}
      {btn('C', editor.isActive('italic'), () => c().toggleItalic().run(), 'Corsivo', { fontStyle: 'italic' })}
      <span className="mx-1 h-5 w-px bg-gray-200" />
      {btn('⟸', editor.isActive({ textAlign: 'left' }), () => c().setTextAlign('left').run(), 'A sinistra')}
      {btn('≡', editor.isActive({ textAlign: 'center' }), () => c().setTextAlign('center').run(), 'Centrato')}
      {btn('⟹', editor.isActive({ textAlign: 'right' }), () => c().setTextAlign('right').run(), 'A destra')}
    </div>
  )
}
