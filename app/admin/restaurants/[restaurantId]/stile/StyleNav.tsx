// Scelta tra le due parti della Personalizzazione del nuovo menu. Link veri
// (navigazione completa): l'avviso delle modifiche non salvate resta valido.
export default function StyleNav({ restaurantId, active }: { restaurantId: string; active: 'menu' | 'landing' }) {
  const base = `/admin/restaurants/${restaurantId}/stile`
  const item = (href: string, on: boolean, label: string) => (
    <a href={href} aria-current={on ? 'page' : undefined}
      className={`px-4 py-1.5 text-sm font-medium transition ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
      {label}
    </a>
  )
  return (
    <nav aria-label="Parti della personalizzazione" className="mb-3 mx-4 sm:mx-0 inline-flex border border-gray-200 bg-gray-50 p-0.5" style={{ borderRadius: 999 }}>
      {item(`${base}/apertura`, active === 'landing', 'Pagina d\'apertura')}
      {item(base, active === 'menu', 'Menu')}
    </nav>
  )
}
