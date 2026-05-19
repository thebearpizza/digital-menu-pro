import { PDFDocument, rgb, PDFPage } from 'pdf-lib'
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

    let pageCount = 1
    // Pagine per categoria
    for (const [category, categoryDishes] of Array.from(categories)) {
      page = pdfDoc.addPage([595, 842])
      pageCount++
      let yPosition = height - 50

      page.drawText(category, {
        x: 50,
        y: yPosition,
        size: 32,
        color: rgb(0.16, 0.11, 0.09),
      })

      yPosition -= 50

      for (const dish of categoryDishes) {
        // Controlla se c'è spazio per il piatto
        if (yPosition < 80) {
          addNavigationArrows(page, pageCount, width, height)
          page = pdfDoc.addPage([595, 842])
          pageCount++
          yPosition = height - 50
        }

        const nameY = yPosition

        // Nome e prezzo
        page.drawText(dish.name, {
          x: 50,
          y: nameY,
          size: 16,
          color: rgb(0.16, 0.11, 0.09),
        })

        if (dish.price) {
          page.drawText(`€ ${dish.price.toFixed(2)}`, {
            x: width - 100,
            y: nameY,
            size: 14,
            color: rgb(0.55, 0.27, 0.07),
          })
        }

        yPosition -= 28

        // Descrizione (truncated preview)
        if (dish.description) {
          let displayDesc = dish.description.trim()
          const maxChars = 70

          if (displayDesc.length > maxChars) {
            displayDesc = displayDesc.substring(0, maxChars - 3) + '...'
          }

          page.drawText(displayDesc, {
            x: 70,
            y: yPosition,
            size: 10,
            color: rgb(0.36, 0.29, 0.22),
          })
        }

        yPosition -= 20
      }

      // Aggiungi frecce al fondo della pagina
      addNavigationArrows(page, pageCount, width, height)
    }

    // Retro copertina
    page = pdfDoc.addPage([595, 842])
    pageCount++
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

function addNavigationArrows(page: PDFPage, pageNum: number, width: number, height: number) {
  // Frecce di navigazione integrate nel PDF
  const arrowSize = 12
  const arrowY = 30

  // Freccia sinistra
  page.drawText('◀', {
    x: 40,
    y: arrowY,
    size: arrowSize,
    color: rgb(0.33, 0.33, 0.33),
  })

  // Freccia destra
  page.drawText('▶', {
    x: width - 60,
    y: arrowY,
    size: arrowSize,
    color: rgb(0.33, 0.33, 0.33),
  })

  // Numero pagina al centro
  page.drawText(pageNum.toString(), {
    x: width / 2 - 10,
    y: arrowY,
    size: 10,
    color: rgb(0.5, 0.5, 0.5),
  })
}
