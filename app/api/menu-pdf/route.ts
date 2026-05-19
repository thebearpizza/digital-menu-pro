import { PDFDocument, rgb, degrees } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    const token = searchParams.get('token')

    if (!menuId || !token) {
      return new Response('Missing menuId or token', { status: 400 })
    }

    const supabase = await createClient()

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id,name')
      .eq('qr_public_token', token)
      .single()

    if (!restaurant) {
      return new Response('Restaurant not found', { status: 404 })
    }

    const { data: menu } = await supabase
      .from('menus')
      .select('id,name,description')
      .eq('id', menuId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (!menu) {
      return new Response('Menu not found', { status: 404 })
    }

    const { data: dishesData } = await supabase
      .from('dishes')
      .select('id,name,description,price,allergens,category,sort_order')
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })

    const dishes = dishesData || []

    // Crea il PDF
    const pdfDoc = await PDFDocument.create()

    // Copertina
    let page = pdfDoc.addPage([595, 842]) // A4
    const { height, width } = page.getSize()

    page.drawText(menu.name, {
      x: 50,
      y: height - 100,
      size: 48,
      color: rgb(0.16, 0.11, 0.09),
    })

    page.drawText(restaurant.name, {
      x: 50,
      y: height - 160,
      size: 24,
      color: rgb(0.36, 0.29, 0.22),
    })

    // Raggruppa per categoria
    const categories = new Map<string, typeof dishes>()
    for (const dish of dishes) {
      const category = dish.category?.trim() || 'Menu'
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(dish)
    }

    // Pagine per categoria
    for (const [category, categoryDishes] of Array.from(categories)) {
      page = pdfDoc.addPage([595, 842])
      let yPosition = height - 50

      page.drawText(category, {
        x: 50,
        y: yPosition,
        size: 32,
        color: rgb(0.16, 0.11, 0.09),
      })

      yPosition -= 50

      for (const dish of categoryDishes) {
        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842])
          yPosition = height - 50
        }

        // Nome e prezzo
        page.drawText(dish.name, {
          x: 50,
          y: yPosition,
          size: 16,
          color: rgb(0.16, 0.11, 0.09),
        })

        if (dish.price) {
          page.drawText(`€ ${dish.price.toFixed(2)}`, {
            x: width - 100,
            y: yPosition,
            size: 14,
            color: rgb(0.55, 0.27, 0.07),
          })
        }

        yPosition -= 25

        // Descrizione
        if (dish.description) {
          const descriptionLines = wrapText(dish.description, 80)
          for (const line of descriptionLines) {
            page.drawText(line, {
              x: 70,
              y: yPosition,
              size: 10,
              color: rgb(0.36, 0.29, 0.22),
            })
            yPosition -= 15
          }
        }

        yPosition -= 10
      }
    }

    // Retro copertina
    page = pdfDoc.addPage([595, 842])
    page.drawText('Grazie!', {
      x: 50,
      y: height - 100,
      size: 48,
      color: rgb(0.16, 0.11, 0.09),
    })

    const pdfBytes = await pdfDoc.save()
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${menu.name}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response('Error generating PDF', { status: 500 })
  }
}

function wrapText(text: string, maxLength: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      if (currentLine) lines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine += (currentLine ? ' ' : '') + word
    }
  }

  if (currentLine) lines.push(currentLine.trim())
  return lines
}
