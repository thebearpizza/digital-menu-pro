'use client'

interface Props {
  /** Optional PDF URL to display. Defaults to the pdfjs sample PDF. */
  pdfUrl?: string | null
}

/**
 * Renders the RaffaeleMorganti/pdf-viewer demo 1:1 inside a full-screen iframe.
 * The viewer is served from /public/pdfviewer/ (static files).
 * Pass pdfUrl to override the default sample PDF via the ?file= query parameter.
 */
export default function ReferenceViewer({ pdfUrl }: Props) {
  const src = pdfUrl
    ? `/pdfviewer/viewer.html?file=${encodeURIComponent(pdfUrl)}`
    : '/pdfviewer/viewer.html'

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="PDF Viewer"
        allow="fullscreen"
      />
    </div>
  )
}
