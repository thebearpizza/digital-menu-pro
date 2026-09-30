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
- **La Personalizzazione deve restare allineata**: ogni elemento nuovo del menu cliente/card va reso configurabile in `CustomizationClient.tsx` (voci `MOBILE_TARGETS`, `MOBILE_LABELS`, `EDITOR_TARGETS`, `case` dell'editor, setter), con default e back-compat in `lib/theme.ts` (`DEFAULT_THEME` + `parseTheme`); le opzioni diventate inutili vanno tolte dall'editor.
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

Il flipbook (`FlipbookViewer.tsx`) usa turn.js + jQuery (`/public/turn.min.js`, `/public/jquery.min.js`) e pdf.js da cdnjs. Decisioni prese con l'utente (non cambiarle senza richiesta):
- **Libro inclinato** `BOOK_TILT_DEG = 14` con spessore pagine / curva / costa decorativi; navigazione dentro la pagina (`drawPageNav`); pagine pubblicitarie a tutta pagina con sfumatura e navigazione in basso.
- **Scheda piatto come pagina del libro** (`DISH_AS_PAGE = true`, `DishModal asPage`): la pagina corrente si gira con uno **sfoglio "rigido" CSS** (`.fv-page-flap`, snapshot della pagina) e scopre la scheda. **NON usare un mini-libro turn.js per la scheda: ha rotto tutto ed è stato scartato.**
  - Apertura senza flash: la scheda resta nascosta (`phase 'prep'`) finché lo snapshot non è decodificato; girata di apertura 1s.
  - Chiusura: torna alla pagina del menu dell'**ultimo piatto visto** (mappa piatto→pagina PDF dal text layer, `dishPdfPageRef`), la pagina si rigira sopra.
  - Abbinamento: la scheda corrente (copia statica) si gira via e scopre l'abbinamento; "Indietro" torna alla scheda da cui è stato aperto (non al primo piatto).
  - In alto: sfumatura scura dall'alto (come le pubblicitarie) con testo chiaro "‹ Torna al menu" / "‹ Indietro" (niente X, niente contorni); colore = `card.backLink.color` schiarito con `readableOn()` quanto basta per il contrasto; auto-fit su una riga.
  - Foto incorniciata (margine, angoli = `card.borderRadius` → "Angoli foto" in Personalizzazione); indicatore "scorri" (⌄) finché sotto c'è altro.
  - Swipe tra piatti: asse deciso dai primi 10px; se il gesto parte in verticale o il testo scorre non cambia mai piatto; swipe orizzontale da 40px.
- PDF (`MenuPDFDocument.tsx`): prezzi allineati alla baseline del nome (strut + lift ottico); con nome centrato un prezzo "fantasma" trasparente sul lato opposto tiene il nome sull'asse della pagina.
- Anteprima dal gestionale (dock "Anteprima"): mostra la L **intera e ferma** (`LitoMark progress={1}`) e naviga solo dopo averla disegnata (Safari smette di ridisegnare durante la navigazione).

### Customization / Theming (`app/admin/.../customization/`)

Pannello per ristoratore:
- Colori (accent, sfondo landing, testo)
- Font (serif, sans-serif — da lista curata Google Fonts)
- Border radius (none, sm, md)
- Immagine di sfondo landing (upload Supabase storage)
- Layout PDF (classic 1 categoria/pagina, compact denser)

Salvato in `restaurants.theme_config` (JSONB). Preview live aggiornato in real-time.

Il tema reale è strutturato (`RestaurantTheme` in `lib/theme.ts`: `landing`, `menu`, `menuThemes`, `card`, `ads`, `customFonts`); `parseTheme` applica default e back-compat. L'anteprima "Card" è un iframe di `/m/[token]?preview=1` che mostra la scheda-pagina reale (`PublicMenuView.tsx`, `cardPreviewOpen`). `card.closeButton` resta nello schema solo per la vecchia scheda a comparsa (non più usata nel menu pubblico).

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

`allergens` è un array di int (ID allergen standard); nomi/numeri personalizzabili per account nella tabella `allergen_overrides`. `theme_config` è JSONB con la struttura `RestaurantTheme` (vedi sopra).

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
- Test locali del menu senza database: pagina temporanea `app/splash-test/page.tsx` che monta `FlipbookViewer`/`DishModal` con dati finti (PDF di prova generato con `pdf-lib` in `public/`), `npx next dev -p 3100` con env Supabase fittizie, pdf.js servito da `pdfjs-dist` locale intercettando cdnjs. **Rimuovere sempre** la pagina, i file di prova in `public/` e `.next/types/app/splash-test` prima del commit.
- Fermare i dev server con `ps aux | grep -E "next" | grep -v grep | awk '{print $2}' | xargs -r kill` (NON `pkill -f "next dev"`: uccide la shell).
- Verifiche prima del push: `npx tsc --noEmit` e `npx eslint <file>`.

## Git workflow

- **`main`** — production-ready, auto-deploy Vercel
- **`preview/<nome>`** — un branch per ogni giro di modifiche, creato da `main` aggiornato; merge via PR solo su richiesta (vedi "Modo di lavorare")
- **Backup branches** — `backup/main-pre-cleanup-2026-05-19`, `backup/custom-flipbook-*` (old attempts)
