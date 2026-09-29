'use client'

// Visibile solo quando il menu è aperto dall'"Anteprima" del gestionale
// (?from=admin): i clienti che arrivano dal QR non lo vedono mai.
export default function AdminBackButton() {
  function goBack() {
    const fromAdmin = document.referrer && new URL(document.referrer).origin === location.origin
      && new URL(document.referrer).pathname.startsWith('/admin')
    if (fromAdmin && history.length > 1) history.back()
    else location.href = '/admin'
  }

  return (
    <button
      type="button"
      onClick={goBack}
      style={{
        position: 'fixed',
        top: 'calc(10px + env(safe-area-inset-top))',
        left: 10,
        zIndex: 2147482000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px 7px 11px',
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        color: '#3a2a08',
        background: 'linear-gradient(180deg, #fdf8ee 0%, #eee2c9 100%)',
        border: '1px solid rgba(168, 147, 108, 0.45)',
        boxShadow: '0 6px 16px rgba(60, 45, 20, 0.28), inset 0 1px 0 rgba(255,255,255,0.9)',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Torna al gestionale"
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>←</span>
      Gestionale
    </button>
  )
}
