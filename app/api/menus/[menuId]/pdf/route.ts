import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
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

export async function GET(
  request: Request,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = await createClient()

    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id, restaurant_id, name, description, theme_config')
      .eq('id', params.menuId)
      .single<MenuRow>()

    if (menuError || !menu) {
      return NextResponse.json({ error: 'Menu non trovato' }, { status: 404 })
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, description')
      .eq('id', menu.restaurant_id)
      .single<RestaurantRow>()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Ristorante non trovato' }, { status: 404 })
    }

    const { data: dishes, error: dishesError } = await supabase
      .from('dishes')
      .select('id, name, description, price, allergens, category, is_available')
      .eq('menu_id', menu.id)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })

    if (dishesError) {
      return NextResponse.json({ error: 'Errore nel caricamento piatti' }, { status: 500 })
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const theme = menu.theme_config || {}
    const colors = theme.colors || {}

    const bgColor = colors.background || '#111111'
    const textColor = colors.text || '#ffffff'
    const mutedColor = colors.muted || '#d6d6d6'
    const accentColor = colors.accent || '#f5d08a'

    const hexToRgb = (hex: string) => {
      const cleaned = hex.replace('#', '')
      const value = cleaned.length === 3
        ? cleaned.split('').map((c) => c + c).join('')
        : cleaned

      const num = parseInt(value, 16)
      return rgb(
        ((num >> 16) & 255) / 255,
        ((num >> 8) & 255) / 255,
        (num & 255) / 255
      )
    }

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: hexToRgb(bgColor),
    })

    let y = height - 60

    page.drawText(restaurant.name, {
      x: 48,
      y,
      size: 26,
      font: fontBold,
      color: hexToRgb(textColor),
    })

    y -= 34

    page.drawText(menu.name, {
      x: 48,
      y,
      size: 18,
      font: fontBold,
      color: hexToRgb(accentColor),
    })

    y -= 28

    if (menu.description) {
      page.drawText(menu.description.slice(0, 140), {
        x: 48,
        y,
        size: 10,
        font: fontRegular,
        color: hexToRgb(mutedColor),
        maxWidth: width - 96,
      })
      y -= 28
    }

    const grouped = groupDishesByCategory((dishes || []) as Dish[])

    for (const [category, items] of grouped) {
      if (y < 120) break

      page.drawText(category.toUpperCase(), {
        x: 48,
        y,
        size: 12,
        font: fontBold,
        color: hexToRgb(accentColor),
      })

      y -= 22

      for (const dish of items) {
        if (y < 90) break

        page.drawText(dish.name, {
          x: 48,
          y,
          size: 13,
          font: fontBold,
          color: hexToRgb(textColor),
        })

        if (dish.price != null) {
          page.drawText(money(dish.price), {
            x: width - 110,
            y,
            size: 12,
            font: fontBold,
            color: hexToRgb(textColor),
          })
        }

        y -= 16

        if (dish.description) {
          page.drawText(dish.description.slice(0, 110), {
            x: 48,
            y,
            size: 10,
            font: fontRegular,
            color: hexToRgb(mutedColor),
            maxWidth: width - 120,
          })
          y -= 14
        }

        if (dish.allergens && dish.allergens.length > 0) {
          page.drawText(`Allergeni: ${dish.allergens.join(', ')}`, {
            x: 48,
            y,
            size: 9,
            font: fontRegular,
            color: hexToRgb(mutedColor),
            maxWidth: width - 120,
          })
          y -= 14
        }

        y -= 10
      }

      y -= 8
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
