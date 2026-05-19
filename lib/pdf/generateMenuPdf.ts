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
  // Tracciamo le pagine delle categorie per shortcut di navigazione
  const categoryPages: Map<string, PDFPage> = new Map()
  // Tracciamo i link annotations per le categorie su ogni menu cover
  type CategoryLink = { x1: number; y1: number; x2: number; y2: number; category: string }
  const menuCoverCategoryLinks: CategoryLink[][] = []

  // ---- Pagina 1: copertina ristorante + scelta menu (accorpate) ----
  const choicePage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let choiceY = PAGE_HEIGHT - 60

  choicePage.drawText(sanitize(payload.restaurant.name), {
    x: MARGIN_X,
    y: choiceY,
    size: 36,
    font: fontBold,
    color: COLOR_INK,
  })
  choiceY -= 50

  choicePage.drawText('Scegli il menu', {
    x: MARGIN_X,
    y: choiceY,
    size: 20,
    font: fontBold,
    color: COLOR_INK,
  })
  choiceY -= 30

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

    // Pagine piatti raggruppati per categoria
    const grouped = groupByCategory(menu.dishes)

    // Aggiungi shortcut alle categorie sulla copertina
    let shortcutY = PAGE_HEIGHT - 320
    menuCover.drawText('Categorie:', {
      x: MARGIN_X,
      y: shortcutY,
      size: 12,
      font: fontBold,
      color: COLOR_SOFT,
    })
    shortcutY -= 18

    const categoryLinks: CategoryLink[] = []

    for (const group of grouped) {
      const catName = sanitize(group.category)
      const categoryText = catName
      const textWidth = fontRegular.widthOfTextAtSize(categoryText, 10)

      menuCover.drawText(categoryText, {
        x: MARGIN_X,
        y: shortcutY,
        size: 10,
        font: fontRegular,
        color: COLOR_ACCENT,
      })

      categoryLinks.push({
        x1: MARGIN_X - 2,
        y1: shortcutY - 2,
        x2: MARGIN_X + textWidth + 2,
        y2: shortcutY + 10,
        category: `${menu.id}:${catName}`,
      })

      shortcutY -= 14
    }

    menuCoverCategoryLinks.push(categoryLinks)

    drawPageFooter(menuCover, pageCounter, fontRegular)
    let page: PDFPage | null = null
    let y = 0

    for (const group of grouped) {
      // Nuova pagina per nuova categoria
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pageCounter++
      y = PAGE_HEIGHT - 60

      // Salva la pagina della categoria per i shortcut
      const categoryKey = `${menu.id}:${sanitize(group.category)}`
      if (!categoryPages.has(categoryKey)) {
        categoryPages.set(categoryKey, page)
      }

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

  // ---- Link annotations per shortcut categorie su ogni menu cover ----
  for (let i = 0; i < menuCoverPages.length; i++) {
    const menuCoverPage = menuCoverPages[i]
    const categoryLinks = menuCoverCategoryLinks[i] || []
    const categoryAnnotRefs: any[] = []

    for (const link of categoryLinks) {
      const targetPage = categoryPages.get(link.category)
      if (!targetPage) continue

      const linkRef = pdf.context.register(
        pdf.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [link.x1, link.y1, link.x2, link.y2],
          Border: [0, 0, 0],
          Dest: [targetPage.ref, 'Fit'],
        })
      )
      categoryAnnotRefs.push(linkRef)
    }

    if (categoryAnnotRefs.length > 0) {
      const categoryAnnots = pdf.context.obj(categoryAnnotRefs)
      menuCoverPage.node.set(PDFName.of('Annots'), categoryAnnots)
    }
  }

  return pdf.save()
}
