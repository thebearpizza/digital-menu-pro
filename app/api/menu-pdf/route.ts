import { PDFDocument, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    console.log('[PDF] Starting PDF generation')

    const url = new URL(request.url)
    const menuId = url.searchParams.get('menuId')
    const token = url.searchParams.get('token')

    console.log('[PDF] Params:', { menuId, token })

    if (!menuId || !token) {
      return new Response('Missing menuId or token', { status: 400 })
    }

    console.log('[PDF] Creating Supabase client')
    const supabase = await createClient()

    console.log('[PDF] Fetching restaurant')
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id,name')
      .eq('qr_public_token', token)
      .single()

    if (restaurantError || !restaurant) {
      console.error('[PDF] Restaurant error:', restaurantError)
      return new Response('Restaurant not found', { status: 404 })
    }

    console.log('[PDF] Fetching menu')
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id,name,description')
      .eq('id', menuId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (menuError || !menu) {
      console.error('[PDF] Menu error:', menuError)
      return new Response('Menu not found', { status: 404 })
    }

    console.log('[PDF] Fetching dishes')
    const { data: dishesData, error: dishesError } = await supabase
      .from('dishes')
      .select('id,name,description,price,allergens,category,sort_order')
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })

    if (dishesError) {
      console.error('[PDF] Dishes error:', dishesError)
    }

    const dishes = dishesData || []
    console.log('[PDF] Got dishes:', dishes.length)

    // Crea il PDF
    console.log('[PDF] Creating PDF document')
    const pdfDoc = await PDFDocument.create()
    console.log('[PDF] PDF document created')

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

      // Titolo categoria
      page.drawText(category, {
        x: 50,
        y: yPosition,
        size: 32,
        color: rgb(0.16, 0.11, 0.09),
      })

      yPosition -= 50

      // Piatti della categoria
      for (const dish of categoryDishes) {
        // Controlla se c'è spazio per il piatto
        if (yPosition < 80) {
          addNavigationArrows(page, pageCount, width, height)
          page = pdfDoc.addPage([595, 842])
          pageCount++
          yPosition = height - 50
        }

        const nameY = yPosition

        // Nome piatto
        page.drawText(dish.name, {
          x: 50,
          y: nameY,
          size: 16,
          color: rgb(0.16, 0.11, 0.09),
        })

        // Prezzo
        if (dish.price) {
          page.drawText(`€ ${dish.price.toFixed(2)}`, {
            x: width - 100,
            y: nameY,
            size: 14,
            color: rgb(0.55, 0.27, 0.07),
          })
        }

        yPosition -= 28

        // Descrizione (truncated)
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

    console.log('[PDF] Saving PDF')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF] PDF saved, size:', pdfBytes.length)

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${menu.name}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
}

function addNavigationArrows(page: any, pageNum: number, width: number, height: number) {
  const arrowSize = 12
  const arrowY = 30

  page.drawText('◀', {
    x: 40,
    y: arrowY,
    size: arrowSize,
    color: rgb(0.33, 0.33, 0.33),
  })

  page.drawText('▶', {
    x: width - 60,
    y: arrowY,
    size: arrowSize,
    color: rgb(0.33, 0.33, 0.33),
  })

  page.drawText(pageNum.toString(), {
    x: width / 2 - 10,
    y: arrowY,
    size: 10,
    color: rgb(0.5, 0.5, 0.5),
  })
}
