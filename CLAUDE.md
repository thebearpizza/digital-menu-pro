# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Digital Menu Pro

App Next.js per gestione menu digitali di ristoranti con QR code. Admin panel per ristoratori + menu pubblico esposto via QR code.

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

## Stack e Dipendenze

- **Next.js 13** (App Router, Server Actions)
- **Supabase** (Postgres DB + Auth + RLS policies)
- **TailwindCSS** + TypeScript
- **Drag-and-drop**: `@dnd-kit` per riordinamento menu/piatti/categorie
- **PDF generation**: `@react-pdf/renderer` + `pdf-lib`
- **Excel import/export**: `xlsx` (non è un CSV plugin — gestisce il file completo)
- **QR code**: `qrcode`

## Sviluppo

```bash
npm run dev          # Server locale su localhost:3000
npm run build        # Build per produzione
npm run start        # Run build locale
npm run lint         # ESLint (accetta fix via --fix)
npx tsc --noEmit    # Type check TypeScript
```

Configurazione Supabase: le variabili sono in `.env.local` (chiave pubblica + URL). RLS policies e trigger sono già definiti nel database remoto.

## Architettura

### Directory layout

- **`app/admin/`** — Gestionale del ristoratore (protetto da auth Supabase + middleware)
  - `restaurants/` — lista ristoranti; per ristorante: menus, customization, Telegram
  - `restaurants/[restaurantId]/menus/` — CRUD menu + drag-drop reorder
  - `restaurants/[restaurantId]/menus/[menuId]/` — CRUD piatti + categorie, Excel import/export, sincronizzazione piatti
  - `restaurants/[restaurantId]/customization/` — Theming: colori, font, layout PDF
  - `restaurants/[restaurantId]/telegram/` — Pairing codes + webhook test
- **`app/auth/`, `app/login/`** — Login / signup Supabase
- **`app/api/`** — API Server Actions + webhook
  - `api/telegram/route.ts` — Webhook Telegram bot (gestione comandi elastici)
  - `api/menus/` — Endpoint per operazioni menu (CRUD, reorder, delete)
  - `api/dishes/` — Endpoint piatti (CRUD)
- **`app/m/[token]/`** — Menu pubblico (NO auth richiesta)
  - `page.tsx` — Entry point: landing page con flipbook viewer + PDF download
  - `PublicMenuView.tsx` — Wrapper che applica theming
  - `FlipbookViewer.tsx` — Viewer a pagine (sfogliabile) — utilizza theme per colori e font
  - `DishModal.tsx` — Modal con dettagli piatto + allergeni
  - `MenuPDFDocument.tsx` — Documento PDF renderizzato
- **`lib/`** — Utilità condivise
  - `menuSchedule.ts` — Logica programmazione oraria menu
  - `theme.ts` — Validazione + defaults tema (quando sarà completo)
  - `googleFontsCatalog.ts` — Lista curata font Google
  - `supabaseAdmin.ts` — Client Supabase con service role (backend-only)
- **`components/ui/`** — Componenti riusabili (VisibilityToggle, modali, ecc.)

### Pattern architetturali

**Server Actions** (`'use server'`) — Gestione state nel backend, riduce boilerplate. Usati per:
- CRUD menu, piatti, categorie
- Reorder (drag-drop)
- Thema save, webhook test
- Excel import

**Client Components** (`'use client'`) — Interattività: drag-drop, form validation, modal state, multi-select.

**Supabase RLS** — Row-level security: gli utenti admin vedono/modificano solo i ristoranti che possiedono (`owner_id`). Il menu pubblico NON richiede auth.

**Elastic parsing** — Telegram bot tollerante a errori:
- `normalizeAccents()` — accenti trasparenti (menù == menu)
- `stripClutter()` — rimuove articoli italiani (il, la, lo, un, ecc.) e preposizioni
- Case-insensitive matching ovunque

## Moduli principali

### Telegram Bot (`app/api/telegram/route.ts`)

Webhook per bot Telegram. Funzionalità:
- **Pairing** — `/collega CODICE` abbina una chat a un account admin (codice 15 min, single-use)
- **Comandi** — prezzo, attiva/disattiva piatto/categoria/menu/ristorante, programma oraria, lista
- **Parsing elastico** — tollerante a accenti, articoli, preposizioni, case

Tabelle chiave:
- `telegram_links(chat_id, user_id)` — mapping chat ↔ account admin
- `telegram_pairing_codes(code, user_id, expires_at)` — one-time pairing codes

### Menu pubblico (`app/m/[token]/`)

Dato `restaurants.qr_public_token`, il server:
1. Recupera il ristorante + tutti i menu + piatti
2. Applica scheduling (menu visibili solo in fascia oraria? hide se disattivo)
3. Applica theming (colori, font, layout PDF)
4. Renderizza landing page + flipbook + PDF download button

Flipbook è sfogliabile pagina per pagina; DishModal mostra allergeni/descrizione. PDF generato lato server via `@react-pdf/renderer`.

### Customization / Theming (`app/admin/.../customization/`)

Pannello per ristoratore:
- Colori (accent, sfondo landing, testo)
- Font (serif, sans-serif — da lista curata Google Fonts)
- Border radius (none, sm, md)
- Immagine di sfondo landing (upload Supabase storage)
- Layout PDF (classic 1 categoria/pagina, compact denser)

Salvato in `restaurants.theme_config` (JSONB). Preview live aggiornato in real-time.

### Excel import/export (`app/admin/.../menus/[menuId]/ExcelImportExport.tsx`)

- **Export** — Scarica foglio Excel con piatti (nome, descrizione, prezzo, categoria, allergeni)
- **Import** — Legge Excel, crea/aggiorna piatti in blocco, sincronizza categorie

### Dish Sync (`app/admin/.../menus/[menuId]/DishSyncBannerModal.tsx`)

Riconosce piatti uguali tra menu diversi (stesso nome + categoria). Se l'utente modifica un piatto, suggerisce di sincronizzare i "twin" (copia modifiche prezzo/descrizione/allergeni).

## Database schema (keys)

- `restaurants(id, owner_id, name, qr_public_token, theme_config, ...)`
- `menus(id, restaurant_id, name, is_active, sort_order, schedule_enabled, schedule_from, schedule_until, ...)`
- `dishes(id, menu_id, name, description, price, category, is_active, image_url, allergens[], sort_order, ...)`
- `categories(menu_id, name)` — relazione virtualizzata (ogni piatto ha una categoria string)
- `telegram_links(chat_id, user_id)` — link admin ↔ Telegram chat
- `telegram_pairing_codes(code, user_id, expires_at)`

`allergens` è un array di int (ID allergen standard). `theme_config` è JSONB con chiavi: accent, pageBg, navBg, textPrimary, textMuted, fontSerif, fontSans, borderRadius, pdfLayout, bgImage, bgImageOpacity.

## Deployment e infra

- **Production**: `https://digital-menu-pro-blush.vercel.app` — auto-deploy su push a `main`
- **Preview deployments**: Vercel genera preview URL (protezione auth di default per security)
- **QR code**: Sempre punta a production URL — mai a preview
- **Supabase**: Progetto remoto connesso via env vars. RLS policies attive in prod.
- **Telegram**: Webhook live, test con curl da GitHub Codespaces (constraint: Claude Code container non ha accesso HTTP esterno)

## Git workflow

- **`main`** — production-ready, auto-deploy Vercel
- **`claude/digital-menu-flipbook-pFdFt`** — feature branch attivo; merge su `main` dopo review
- **Backup branches** — `backup/main-pre-cleanup-2026-05-19`, `backup/custom-flipbook-*` (old attempts)
