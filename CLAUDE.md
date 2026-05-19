# Digital Menu Pro

App Next.js per gestione menu digitali di ristoranti con QR code.

## Vincoli inviolabili

### 🔒 URL del QR code stabile per sempre

Il pattern URL del QR code pubblico è:

```
https://<dominio-production>/m/<qr_public_token>
```

dove `qr_public_token` è la colonna sulla tabella `restaurants` di Supabase.

**Questo URL non può MAI cambiare**, perché i QR code vengono stampati fisicamente e affissi nei ristoranti. Qualsiasi modifica al codice del menu lato cliente DEVE mantenere questo pattern come entry point.

Costruito in: `app/admin/restaurants/[restaurantId]/components/QRCodeCard.tsx`

Implicazioni pratiche:
- Si può modificare/riscrivere completamente la pagina servita da `/m/[token]`, ma il path `/m/[token]` deve sempre esistere e funzionare.
- Non aggiungere segmenti obbligatori (es. `/m/[token]/menu/[menuId]` come unico ingresso): se serve la scelta del menu, va integrata nella stessa pagina `/m/[token]`.
- Il token non si rigenera mai, è permanente per ristorante.

## Struttura

- `app/admin/` — Gestionale del ristoratore (protetto da auth Supabase)
- `app/auth/`, `app/login/` — Flusso di autenticazione admin
- `app/api/menus/` — API admin per gestione menu
- `app/m/[token]/` — Menu pubblico per i clienti (da ricostruire con PDF viewer animato)
- `middleware.ts` — Protegge solo `/admin/*`, il path `/m/*` deve restare pubblico

## Stack

- Next.js 13 (App Router)
- Supabase (DB + Auth)
- TailwindCSS
- TypeScript

## Deploy

- Production: `https://digital-menu-pro-blush.vercel.app` (auto-deploy da `main`)
- Preview deployments su Vercel hanno protezione autenticazione abilitata di default — usare sempre l'URL di production nei QR.

## Backup

Branch di backup disponibili su GitHub:
- `backup/main-pre-cleanup-2026-05-19` — Ultimo main con tentativo di PDF viewer integrato
- `backup/custom-flipbook-start`, `backup/react-pageflip-working-attempt` — Tentativi viewer precedenti
