'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  value: string
  onChange: (url: string) => void
  accept?: string
  label?: string
  preview?: 'image' | 'video' | 'auto'
}

export function MediaUpload({ value, onChange, accept = 'image/*,video/*', label = 'immagine o video', preview = 'auto' }: Props) {
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('media')
      .upload(path, file, { upsert: true })

    if (error) {
      alert('Errore upload: ' + error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    uploadFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  function getPreviewType(url: string): 'image' | 'video' {
    if (preview !== 'auto') return preview
    const ext = url.split('.').pop()?.toLowerCase()
    if (['mp4', 'webm', 'mov', 'gif'].includes(ext ?? '')) return 'video'
    return 'image'
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">{label}</label>

      {/* Area drag & drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          drag
            ? 'border-slate-900 bg-slate-50'
            : 'border-stone-200 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Caricamento in corso...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">Sfoglia</span> o trascina qui
            </p>
            <p className="text-xs text-slate-400">Immagini, video, GIF</p>
          </div>
        )}
      </div>

      {/* Campo URL manuale */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-xs text-slate-400">oppure incolla un URL</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
        placeholder="https://..."
      />

      {/* Anteprima */}
      {value && (
        <div className="relative group">
          {getPreviewType(value) === 'video' ? (
            <video
              src={value}
              className="w-full max-h-48 rounded-xl object-contain bg-stone-50 border border-stone-200"
              muted autoPlay loop playsInline
            />
          ) : (
            <img
              src={value}
              alt="Anteprima"
              className="w-full max-h-48 rounded-xl object-contain bg-stone-50 border border-stone-200"
            />
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full shadow border border-stone-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
          >
            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
