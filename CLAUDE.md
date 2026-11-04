# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Lito (ex Digital Menu Pro)

App Next.js per gestione menu digitali di ristoranti con QR code. Admin panel per ristoratori + menu pubblico esposto via QR code. Il prodotto si chiama **Lito** (logo: L corsiva dorata scritta a pennino, `components/LitoMark.tsx`); il repo e il progetto Vercel mantengono il nome `digital-menu-pro`.

L'utente scrive in italiano: rispondere in italiano, in modo chiaro e non tecnico.

## Modo di lavorare (concordato con l'utente)

- **Mai toccare `main` direttamente.** Ogni modifica va su un branch di anteprima nuovo creato da `main` aggiornato (`git fetch origin main && git checkout -B preview/<nome> origin/main`), poi push e link dell'anteprima Vercel all'utente.
- **Merge su `main` solo quando l'utente scrive "merge"**: si apre una PR (GitHub MCP `create_pull_request`) e la si unisce (`merge_pull_request`, metodo merge). Poi si verifica che parta il deploy di produzione.
- Link anteprima: Vercel MCP `list_deployments` con `projectId: prj_b8WrdpZ6p9k0vasfGiZiT3iwKyaM`, `teamId: team_Cs7hzXgCmjtavJpTfK8vNEoz`, `branch: <branch>`; il campo `url` è l'anteprima (se `BUILDING`, dirlo).
- **Non rompere le funzionalità esistenti**: modifiche minime e mirate. Se un tentativo rompe tutto, si butta il branch e si riparte da `main` rifacendo solo le modifiche richieste.
- **La Personalizzazione deve restare allineata**: ogni elemento nuovo del menu cliente (pagine, scheda del piatto, pagina d'apertura) va reso configurabile nella Personalizzazione (`stile/StyleEditor.tsx` per il menu, `stile/LandingEditor.tsx` per la pagina d'apertura), con default e back-compat in `lib/menuStyle.ts` (`DEFAULT_STYLE` + `parseStyle`) o `lib/landingStyle.ts` (`DEFAULT_LANDING` + `parseLanding`); le opzioni diventate inutili vanno tolte dall'editor.
- **Il menu deve essere sempre fluido**: niente lavoro pesante nei fotogrammi in cui si sfoglia (es. le animazioni dei titoli si fermano mentre si gira pagina).
- La cancellazione di branch remoti è bloccata dal proxy git: dire all'utente di eliminarli a mano dalla pagina Branches di GitHub.

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
- **PDF**: pagine disegnate dal motore del menu (`app/prova/[token]/menuPdf.ts`) e unite con `pdf-lib`
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
  - `restaurants/` — lista ristoranti; per ristorante: menus, Personalizzazione (`stile/`), Telegram
  - `restaurants/[restaurantId]/menus/` — CRUD menu + drag-drop reorder
  - `restaurants/[restaurantId]/menus/[menuId]/` — CRUD piatti + categorie, Excel import/export, sincronizzazione piatti
  - `restaurants/[restaurantId]/stile/` — Personalizzazione: stile del menu (`StyleEditor`) e pagina d'apertura (`apertura/`, `LandingEditor`); `customization/` reindirizza qui
  - `restaurants/[restaurantId]/telegram/` — Pairing codes + webhook test
- **`app/auth/`, `app/login/`** — Login / signup Supabase
- **`app/api/`** — API Server Actions + webhook
  - `api/telegram/route.ts` — Webhook Telegram bot (gestione comandi elastici)
  - `api/menus/` — Endpoint per operazioni menu (CRUD, reorder, delete)
  - `api/dishes/` — Endpoint piatti (CRUD)
- **`app/m/[token]/`** — Menu pubblico del QR (NO auth): `page.tsx` serve `NewMenuPage` (conta visite e aperture), `privacy/`
- **`app/prova/[token]/`** — Il menu vero e proprio (stesso contenuto anche su `/prova/<token>`, usato dalle anteprime senza statistiche)
  - `NewMenuPage.tsx` — server: pagina d'apertura (`Landing.tsx`) o menu (`CurlMenu.tsx`) con `?menu=<id>`
  - `menuData.ts` — dati del menu per il motore (condiviso con il PDF)
  - `typeset.ts` — impaginazione e disegno delle pagine su canvas; `curl.ts` — giro pagina WebGL
  - `DishCard.tsx` — scheda del piatto; `menuPdf.ts` — PDF con la stessa grafica
- **`lib/`** — Utilità condivise
  - `menuSchedule.ts` — Logica programmazione oraria menu
  - `menuStyle.ts` / `landingStyle.ts` — stile del menu e della pagina d'apertura (schema, default, back-compat)
  - `theme.ts` — vecchio tema (`theme_config`): ne restano solo le pubblicità convertite (`lib/menuMedia.ts`) e poco altro
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

### Menu pubblico (`app/m/[token]/` → `app/prova/[token]/`)

Dato `restaurants.qr_public_token`, `NewMenuPage`:
1. Recupera il ristorante e i menu attivi (programmazione oraria: fuori fascia menu, categorie e piatti non compaiono)
2. Senza `?menu=` mostra la pagina d'apertura (`Landing.tsx`, stile in `restaurants.landing_style`)
3. Con `?menu=<id>` mostra il menu a tutto schermo con giro pagina (`CurlMenu.tsx`, stile in `menus.menu_style` o `restaurants.menu_style`)

Le pagine sono disegnate su canvas da `typeset.ts` e diventano texture WebGL (`curl.ts`). I titoli animati (neon, riflesso, lampadine…) ridisegnano solo la loro striscia, solo quando lo stato cambia, e restano fermi mentre si sfoglia. I Google Fonts passano dal proxy `app/api/gfonts`, mai direttamente da Google; dei caratteri caricati si scaricano solo le facce usate.

Il PDF (gestionale: "Scarica PDF" del menu e "tutti i menu" del ristorante) usa gli stessi dati (`menuData.ts`, senza orari) e lo stesso motore: pagine A4, carta salvata una volta e testi in un livello trasparente sopra (`menuPdf.ts`).

### Personalizzazione (`app/admin/.../stile/`)

- **Menu** (`StyleEditor.tsx`): carta e sfondo, caratteri (anche caricati), copertina, categorie (decorazioni, effetti, animazioni), piatti, prezzi, pagine informativa e allergeni, foto/video, scheda del piatto, comandi in vetro, sfoglio. Anteprima: iframe di `/prova/<token>?preview=1` che riceve lo stile con `postMessage`.
- **Pagina d'apertura** (`LandingEditor.tsx`): sfondo (carta, gradiente, foto e video), logo e nome, pulsanti dei menu, vetro, social.

### Excel import/export (`app/admin/.../menus/[menuId]/ExcelImportExport.tsx`)

- **Export** — Scarica foglio Excel con piatti (nome, descrizione, prezzo, categoria, allergeni)
- **Import** — Legge Excel, crea/aggiorna piatti in blocco, sincronizza categorie

### Dish Sync (`app/admin/.../menus/[menuId]/DishSyncBannerModal.tsx`)

Riconosce piatti uguali tra menu diversi (stesso nome + categoria). Se l'utente modifica un piatto, suggerisce di sincronizzare i "twin" (copia modifiche prezzo/descrizione/allergeni).

## Database schema (keys)

- `restaurants(id, owner_id, name, qr_public_token, landing_style, menu_style, theme_config, ...)`
- `menus(id, restaurant_id, name, is_active, sort_order, schedule_enabled, schedule_from, schedule_until, ...)`
- `dishes(id, menu_id, name, description, price, category, is_active, image_url, allergens[], sort_order, ...)`
- `categories(menu_id, name)` — relazione virtualizzata (ogni piatto ha una categoria string)
- `telegram_links(chat_id, user_id)` — link admin ↔ Telegram chat
- `telegram_pairing_codes(code, user_id, expires_at)`

`allergens` è un array di int (ID allergen standard); nomi/numeri personalizzabili per account nella tabella `allergen_overrides`. Lo stile è JSONB: `menus.menu_style` / `restaurants.menu_style` (`MenuStyle`, `lib/menuStyle.ts`) e `restaurants.landing_style` (`LandingStyle`); `menus.media_pages` le pagine foto/video. `theme_config` (vecchio tema) e `restaurants.new_menu` non servono più al menu.

Supabase project id: `spwyryxoqsiahfwnpaoo`.

## Deployment e infra

- **Production**: `https://digital-menu-pro-blush.vercel.app` — auto-deploy su push a `main`
- **Preview deployments**: Vercel genera preview URL (protezione auth di default per security)
- **QR code**: Sempre punta a production URL — mai a preview
- **Supabase**: Progetto remoto connesso via env vars. RLS policies attive in prod.
- **Telegram**: Webhook live, test con curl da GitHub Codespaces

### Ambiente cloud di Claude Code
- Rete: accesso "Personalizzato" con `*.vercel.app`, `spwyryxoqsiahfwnpaoo.supabase.co`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com` + elenco predefinito. Tutto passa da un proxy che ri-firma l'HTTPS.
- **Browser**: MCP `chrome-devtools` (`.mcp.json`) con il Chromium preinstallato, headless, `--no-sandbox`, `--acceptInsecureCerts` (certificato del proxy). In alternativa Playwright installato globalmente (percorso da `npm root -g`, opzione `ignoreHTTPSErrors: true`).
- Le anteprime Vercel sono protette da login Vercel: senza bypass il browser vede la pagina di accesso; la produzione è libera. Il gestionale richiede login Supabase (serve un account di test, mai credenziali personali).
- Test locali: `npx next dev -p 3100` con le chiavi pubbliche di Supabase; il menu vero si prova su `/prova/<token>?menu=<id>` (con `&preview=1` accetta lo stile via `postMessage` `lito-style`). Per i pannelli del gestionale (serve il login) si usa una pagina temporanea `app/splash-test/page.tsx`. **Rimuovere sempre** la pagina e `.next/types/app/splash-test` prima del commit. Il Chromium di prova non riproduce MP4/H.264: per i video si usa una copia WebM servita con `page.route`.
- Fermare i dev server con `ps aux | grep -E "next" | grep -v grep | awk '{print $2}' | xargs -r kill` (NON `pkill -f "next dev"`: uccide la shell).
- Verifiche prima del push: `npx tsc --noEmit` e `npx eslint <file>`.

## Git workflow

- **`main`** — production-ready, auto-deploy Vercel
- **`preview/<nome>`** — un branch per ogni giro di modifiche, creato da `main` aggiornato; merge via PR solo su richiesta (vedi "Modo di lavorare")
- **Backup branches** — `backup/main-pre-cleanup-2026-05-19`, `backup/custom-flipbook-*` (old attempts)
