import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  allergens: string[] | null
  category: string | null
  is_available: boolean
}

type MenuRow = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  theme_config: Record<string, any> | null
}

type RestaurantRow = {
  id: string
  name: string
  description: string | null
}

function money(value: number | null) {
  if (value == null) return ''
  return `€${Number(value).toFixed(2)}`
}

function groupDishesByCategory(dishes: Dish[]) {
  const map = new Map<string, Dish[]>()
  for (const dish of dishes) {
    const key = dish.category?.trim() || 'Senza categoria'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dish)
  }
  return Array.from(map.entries())
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace('#', '')
  const value = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned
  const num = parseInt(value, 16)
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255)
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) current = next
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function GET(request: Request, { params }: { params: { menuId: string } }) {
  try {
    const supabase = await createClient()
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, restaurant_id, name, description, theme_config')
      .eq('id', params.menuId)
      .single<MenuRow>()

    if (menuError || !menu) return NextResponse.json({ error: 'Menu non trovato' }, { status: 404 })

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, description')
      .eq('id', menu.restaurant_id)
      .single<RestaurantRow>()

    if (restaurantError || !restaurant) return NextResponse.json({ error: 'Ristorante non trovato' }, { status: 404 })

    const { data: dishes, error: dishesError } = await supabase
      .from('dishes')
      .select('id, name, description, price, allergens, category, is_available')
      .eq('menu_id', menu.id)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })

    if (dishesError) return NextResponse.json({ error: 'Errore nel caricamento piatti' }, { status: 500 })

    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const theme = menu.theme_config || {}
    const colors = theme.colors || {}
    const bgColor = colors.background || '#111111'
    const textColor = colors.text || '#ffffff'
    const mutedColor = colors.muted || '#d6d6d6'
    const accentColor = colors.accent || '#f5d08a'
    const PAGE_WIDTH = 595.28
    const PAGE_HEIGHT = 841.89
    const MARGIN_X = 48
    const TOP = 60
    const BOTTOM = 60
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    let y = 0

    const paintPageBackground = () => {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: hexToRgb(bgColor) })
      y = PAGE_HEIGHT - TOP
    }

    const createPage = () => {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      paintPageBackground()
      return page
    }

    const ensureSpace = (minHeight: number) => {
      if (y - minHeight < BOTTOM) createPage()
    }

    const drawTextBlock = (
      lines: string[],
      opts: { x?: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; lineGap?: number }
    ) => {
      const x = opts.x ?? MARGIN_X
      const lineGap = opts.lineGap ?? 4
      for (const line of lines) {
        page.drawText(line, { x, y, size: opts.size, font: opts.font, color: opts.color })
        y -= opts.size + lineGap
      }
    }

    paintPageBackground()

    page.drawText(restaurant.name, { x: MARGIN_X, y, size: 28, font: fontBold, color: hexToRgb(textColor) })
    y -= 38

    page.drawText(menu.name, { x: MARGIN_X, y, size: 18, font: fontBold, color: hexToRgb(accentColor) })
    y -= 28

    if (menu.description) {
      const lines = wrapText(menu.description, 90)
      drawTextBlock(lines, { size: 10, font: fontRegular, color: hexToRgb(mutedColor), lineGap: 3 })
      y -= 12
    }

    const grouped = groupDishesByCategory((dishes || []) as Dish[])

    for (const [category, items] of grouped) {
      createPage()

      page.drawText(category.toUpperCase(), {
        x: MARGIN_X,
        y,
        size: 22,
        font: fontBold,
        color: hexToRgb(accentColor),
      })
      y -= 30

      page.drawText(menu.name, {
        x: MARGIN_X,
        y,
        size: 10,
        font: fontRegular,
        color: hexToRgb(mutedColor),
      })
      y -= 26

      for (const dish of items) {
        const descriptionLines = dish.description ? wrapText(dish.description, 85) : []
        const allergensLine =
          dish.allergens && dish.allergens.length > 0
            ? `Allergeni: ${dish.allergens.join(', ')}`
            : null

        const estimatedHeight = 18 + descriptionLines.length * 13 + (allergensLine ? 13 : 0) + 20
        ensureSpace(estimatedHeight)

        page.drawText(dish.name, {
          x: MARGIN_X,
          y,
          size: 13,
          font: fontBold,
          color: hexToRgb(textColor),
        })

        if (dish.price != null) {
          page.drawText(money(dish.price), {
            x: PAGE_WIDTH - 110,
            y,
            size: 12,
            font: fontBold,
            color: hexToRgb(textColor),
          })
        }

        y -= 18

        if (descriptionLines.length > 0) {
          drawTextBlock(descriptionLines, {
            size: 10,
            font: fontRegular,
            color: hexToRgb(mutedColor),
            lineGap: 3,
          })
        }

        if (allergensLine) {
          page.drawText(allergensLine, {
            x: MARGIN_X,
            y,
            size: 9,
            font: fontRegular,
            color: hexToRgb(mutedColor),
          })
          y -= 13
        }

        y -= 12
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="menu-${menu.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Errore generazione PDF' }, { status: 500 })
  }
}
