import { PDFDocument, PDFFont, PDFName, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PdfMenu, PdfPayload } from './types'

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

function drawPageFooter(page: PDFPage, pageNum: number, font: PDFFont) {
  const y = 25
  page.drawText('«', { x: 30, y, size: 21, font, color: COLOR_ARROW })
  page.drawText('»', { x: PAGE_WIDTH - 40, y, size: 21, font, color: COLOR_ARROW })
  const label = sanitize(String(pageNum))
  const labelWidth = font.widthOfTextAtSize(label, 14)
  page.drawText(label, {
    x: (PAGE_WIDTH - labelWidth) / 2,
    y,
    size: 14,
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

export async function generateMenuPdf(payload: PdfPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Tracciamo le pagine "copertina menu" per costruire link cliccabili dalla pagina di scelta.
  const menuCoverPages: PDFPage[] = []

  // ---- Pagina 1: copertina ristorante ----
  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  cover.drawText(sanitize(payload.restaurant.name), {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 140,
    size: 42,
    font: fontBold,
    color: COLOR_INK,
  })
  cover.drawText('Menu digitale', {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 180,
    size: 16,
    font: fontRegular,
    color: COLOR_SOFT,
  })

  // ---- Pagina 2: scelta menu (link annotations cliccabili) ----
  // La creiamo SUBITO ma popoleremo gli annot dopo, quando avremo i ref delle copertine.
  const choicePage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let choiceY = PAGE_HEIGHT - 100
  choicePage.drawText('Scegli il menu', {
    x: MARGIN_X,
    y: choiceY,
    size: 28,
    font: fontBold,
    color: COLOR_INK,
  })
  choiceY -= 18
  choicePage.drawText('Tocca un menu per aprirlo', {
    x: MARGIN_X,
    y: choiceY,
    size: 11,
    font: fontRegular,
    color: COLOR_SOFT,
  })
  choiceY -= 50

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
  let pageCounter = 2 // copertina + scelta = 2 finora
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

        page.drawText(sanitize(dish.name), {
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
          const lines = wrapText(sanitize(dish.description), 80).slice(0, 2)
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

  return pdf.save()
}
