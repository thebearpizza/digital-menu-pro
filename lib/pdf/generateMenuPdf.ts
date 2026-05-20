import { PDFDocument, PDFFont, PDFName, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PdfMenu, PdfPayload } from './types'
import { allergenNumbers } from '@/lib/allergens'

export type DishPosition = {
  id: string
  pageNumber: number
  yTopPercent: number
  yBottomPercent: number
}

export type GeneratedMenuPdf = {
  bytes: Uint8Array
  dishPositions: DishPosition[]
  totalPages: number
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN_X = 50
const COLOR_INK = rgb(0.16, 0.11, 0.09)
const COLOR_SOFT = rgb(0.36, 0.29, 0.22)
const COLOR_ACCENT = rgb(0.55, 0.27, 0.07)
const COLOR_ARROW = rgb(0.55, 0.5, 0.45)

// Helvetica usa WinAnsi: serve sanitizzare i caratteri Unicode non supportati
// (emoji, smart quotes, em-dash, frecce stilizzate, ecc.)
function sanitize(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x00-\xFF]/g, '')
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// Wrap basato sulla larghezza in pixel — più preciso del char count.
// Spezza anche le "parole" troppo lunghe (es. testi senza spazi) carattere per carattere.
function wrapTextByWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  function flushCurrent() {
    if (current) {
      lines.push(current)
      current = ''
    }
  }

  function splitLongWord(word: string): string[] {
    const chunks: string[] = []
    let remaining = word
    while (font.widthOfTextAtSize(remaining, fontSize) > maxWidth) {
      let n = 1
      while (
        n < remaining.length &&
        font.widthOfTextAtSize(remaining.slice(0, n + 1), fontSize) <= maxWidth
      ) {
        n++
      }
      chunks.push(remaining.slice(0, n))
      remaining = remaining.slice(n)
    }
    if (remaining) chunks.push(remaining)
    return chunks
  }

  for (const word of words) {
    // Parola gigante: spezzala in chunk di larghezza maxWidth
    if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
      flushCurrent()
      const chunks = splitLongWord(word)
      // tutti i chunk tranne l'ultimo riempiono una riga; l'ultimo diventa "current"
      for (let i = 0; i < chunks.length - 1; i++) lines.push(chunks[i])
      current = chunks[chunks.length - 1]
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      flushCurrent()
      current = word
    }
  }
  flushCurrent()
  return lines
}

// Tronca una riga aggiungendo "…" se la larghezza supera maxWidth.
function truncateToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text
  let truncated = text
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '…', fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated.replace(/\s+$/, '') + '…'
}

function drawPageFooter(page: PDFPage, pageNum: number, font: PDFFont) {
  const y = 25
  const prevLabel = 'Prec.'
  const nextLabel = 'Succ.'
  const nextWidth = font.widthOfTextAtSize(nextLabel, 18)
  page.drawText(prevLabel, { x: 30, y, size: 18, font, color: COLOR_ARROW })
  page.drawText(nextLabel, { x: PAGE_WIDTH - 30 - nextWidth, y, size: 18, font, color: COLOR_ARROW })
  const label = sanitize(String(pageNum))
  const labelWidth = font.widthOfTextAtSize(label, 18)
  page.drawText(label, {
    x: (PAGE_WIDTH - labelWidth) / 2,
    y,
    size: 18,
    font,
    color: COLOR_ARROW,
  })
}

function groupByCategory(dishes: PdfMenu['dishes']) {
  const map = new Map<string, PdfMenu['dishes']>()
  for (const dish of dishes) {
    const key = (dish.category?.trim() || 'Menu')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dish)
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }))
}

export async function generateMenuPdf(payload: PdfPayload): Promise<GeneratedMenuPdf> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Tracciamo le pagine "copertina menu" per costruire link cliccabili dalla pagina di scelta.
  const menuCoverPages: PDFPage[] = []

  // Posizioni dei piatti: pagina e Y top/bottom in percentuale (0 = top, 1 = bottom).
  // Usate dal client per posizionare gli overlay HTML cliccabili sopra il PDF.
  const dishPositions: DishPosition[] = []

  // ---- Pagina 1: copertina ristorante + scelta menu (accorpate) ----
  const choicePage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let choiceY = PAGE_HEIGHT - 80

  // Nome ristorante al centro in alto
  const restaurantName = sanitize(payload.restaurant.name)
  const nameWidth = fontBold.widthOfTextAtSize(restaurantName, 32)
  choicePage.drawText(restaurantName, {
    x: (PAGE_WIDTH - nameWidth) / 2,
    y: choiceY,
    size: 32,
    font: fontBold,
    color: COLOR_INK,
  })
  choiceY -= 80

  type ChoiceRect = { x1: number; y1: number; x2: number; y2: number }
  const choiceRects: ChoiceRect[] = []

  for (const menu of payload.menus) {
    const cardX = MARGIN_X
    const cardY = choiceY - 64
    const cardWidth = PAGE_WIDTH - MARGIN_X * 2
    const cardHeight = 64

    choicePage.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      borderColor: COLOR_SOFT,
      borderWidth: 1,
      color: rgb(0.98, 0.96, 0.92),
    })

    choicePage.drawText(sanitize(menu.name), {
      x: cardX + 18,
      y: cardY + cardHeight - 28,
      size: 18,
      font: fontBold,
      color: COLOR_INK,
    })

    if (menu.description) {
      const desc = sanitize(menu.description)
      const lines = wrapText(desc, 50)
      const text = lines.length > 0 ? lines[0] : ''
      const truncated = text.length > 50 ? text.slice(0, 50) + '…' : text
      choicePage.drawText(truncated, {
        x: cardX + 18,
        y: cardY + 14,
        size: 10,
        font: fontRegular,
        color: COLOR_SOFT,
      })
    }

    choicePage.drawText('»', {
      x: cardX + cardWidth - 28,
      y: cardY + cardHeight / 2 - 8,
      size: 18,
      font: fontBold,
      color: COLOR_ARROW,
    })

    choiceRects.push({ x1: cardX, y1: cardY, x2: cardX + cardWidth, y2: cardY + cardHeight })
    choiceY = cardY - 14
  }

  // ---- Pagine per ogni menu ----
  let pageCounter = 1 // solo la pagina di benvenuto/scelta
  for (const menu of payload.menus) {
    // Copertina menu
    const menuCover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pageCounter++
    menuCoverPages.push(menuCover)

    menuCover.drawText(sanitize(menu.name), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 160,
      size: 36,
      font: fontBold,
      color: COLOR_INK,
    })

    if (menu.description) {
      const lines = wrapText(sanitize(menu.description), 60)
      let y = PAGE_HEIGHT - 210
      for (const line of lines.slice(0, 4)) {
        menuCover.drawText(line, { x: MARGIN_X, y, size: 12, font: fontRegular, color: COLOR_SOFT })
        y -= 16
      }
    }

    drawPageFooter(menuCover, pageCounter, fontRegular)

    // Pagine piatti raggruppati per categoria
    const grouped = groupByCategory(menu.dishes)
    let page: PDFPage | null = null
    let y = 0

    for (const group of grouped) {
      // Nuova pagina per nuova categoria
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pageCounter++
      y = PAGE_HEIGHT - 60

      page.drawText(sanitize(group.category), {
        x: MARGIN_X,
        y,
        size: 24,
        font: fontBold,
        color: COLOR_ACCENT,
      })
      y -= 12
      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: PAGE_WIDTH - MARGIN_X, y },
        thickness: 0.5,
        color: COLOR_SOFT,
      })
      y -= 28

      for (const dish of group.items) {
        // Stima altezza riga: nome 16pt + descrizione (max 2 righe da 12pt) + gap = ~60
        if (y < 80) {
          drawPageFooter(page, pageCounter, fontRegular)
          page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
          pageCounter++
          y = PAGE_HEIGHT - 60

          page.drawText(sanitize(group.category) + ' (segue)', {
            x: MARGIN_X,
            y,
            size: 14,
            font: fontRegular,
            color: COLOR_SOFT,
          })
          y -= 28
        }

        // Y top del blocco piatto (per overlay hit-box). +14 = ascender approssimato del nome.
        const dishYTop = y + 14

        const dishName = sanitize(dish.name)
        page.drawText(dishName, {
          x: MARGIN_X,
          y,
          size: 14,
          font: fontBold,
          color: COLOR_INK,
        })

        if (dish.price != null) {
          const priceLabel = `EUR ${dish.price.toFixed(2)}`
          const priceWidth = fontBold.widthOfTextAtSize(priceLabel, 13)
          page.drawText(priceLabel, {
            x: PAGE_WIDTH - MARGIN_X - priceWidth,
            y,
            size: 13,
            font: fontBold,
            color: COLOR_ACCENT,
          })
        }

        y -= 18

        if (dish.description) {
          // La descrizione deve terminare 10px prima della colonna del prezzo
          // (se c'è il prezzo, altrimenti usa il margine destro standard).
          let descMaxWidth = PAGE_WIDTH - MARGIN_X * 2 - 8 - 10
          if (dish.price != null) {
            const priceLabel = `EUR ${dish.price.toFixed(2)}`
            const priceWidth = fontBold.widthOfTextAtSize(priceLabel, 13)
            const priceLeftX = PAGE_WIDTH - MARGIN_X - priceWidth
            descMaxWidth = priceLeftX - 10 - (MARGIN_X + 8)
          }
          const allLines = wrapTextByWidth(sanitize(dish.description), fontRegular, 10, descMaxWidth)
          const MAX_LINES = 2
          const lines = allLines.slice(0, MAX_LINES)
          // Se la descrizione era più lunga, aggiungi "…" alla fine dell'ultima riga visibile.
          if (allLines.length > MAX_LINES && lines.length > 0) {
            lines[lines.length - 1] = truncateToWidth(lines[lines.length - 1] + '…', fontRegular, 10, descMaxWidth)
          }
          for (const line of lines) {
            page.drawText(line, {
              x: MARGIN_X + 8,
              y,
              size: 10,
              font: fontRegular,
              color: COLOR_SOFT,
            })
            y -= 13
          }
        }

        // Numeri allergeni sotto la descrizione (ordine UE 1-14).
        const allergenNums = allergenNumbers(dish.allergens)
        if (allergenNums.length > 0) {
          page.drawText(allergenNums.join(', '), {
            x: MARGIN_X + 8,
            y,
            size: 9,
            font: fontRegular,
            color: COLOR_SOFT,
          })
          y -= 11
        }

        // Y bottom: stretto all'ultima riga di testo, no gap inferiore
        // (evita sovrapposizione click con il piatto successivo).
        const dishYBottom = y + 2

        dishPositions.push({
          id: dish.id,
          pageNumber: pageCounter,
          yTopPercent: (PAGE_HEIGHT - dishYTop) / PAGE_HEIGHT,
          yBottomPercent: (PAGE_HEIGHT - dishYBottom) / PAGE_HEIGHT,
        })

        y -= 12
      }

      if (page) drawPageFooter(page, pageCounter, fontRegular)
    }

    // Se il menu non ha piatti, la copertina menu basta (già aggiunta sopra)
  }

  // ---- Link annotations sulla pagina di scelta ----
  // Ora che abbiamo i ref delle copertine menu, creiamo i link cliccabili.
  const annotsArray = pdf.context.obj([])
  for (let i = 0; i < payload.menus.length; i++) {
    const rect = choiceRects[i]
    const target = menuCoverPages[i]
    if (!rect || !target) continue

    const linkRef = pdf.context.register(
      pdf.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [rect.x1, rect.y1, rect.x2, rect.y2],
        Border: [0, 0, 0],
        Dest: [target.ref, 'Fit'],
      })
    )
    annotsArray.push(linkRef)
  }
  choicePage.node.set(PDFName.of('Annots'), annotsArray)

  const bytes = await pdf.save()
  return { bytes, dishPositions, totalPages: pageCounter }
}
