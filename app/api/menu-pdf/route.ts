import { PDFDocument, rgb } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    console.log('[PDF] === START PDF GENERATION ===')

    const url = new URL(request.url)
    const menuId = url.searchParams.get('menuId')
    const token = url.searchParams.get('token')

    console.log('[PDF] Params received:', { menuId, token })

    if (!menuId || !token) {
      console.error('[PDF] Missing params')
      return new Response('Missing menuId or token', { status: 400 })
    }

    // Test: crea un PDF semplice per verificare il flusso
    console.log('[PDF] Creating test PDF with menu data')
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842])
    const { height, width } = page.getSize()

    // Titolo
    page.drawText('Menu', {
      x: 50,
      y: height - 100,
      size: 48,
      color: rgb(0.16, 0.11, 0.09),
    })

    // Sottotitolo
    page.drawText(`Menu ID: ${menuId}`, {
      x: 50,
      y: height - 160,
      size: 14,
      color: rgb(0.36, 0.29, 0.22),
    })

    page.drawText('Caricamento piatti...', {
      x: 50,
      y: height - 200,
      size: 12,
      color: rgb(0.36, 0.29, 0.22),
    })

    // Tenta di caricare i dati
    console.log('[PDF] Creating Supabase client...')
    const supabase = await createClient()
    console.log('[PDF] Supabase client created')

    console.log('[PDF] Fetching restaurant with token:', token)
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id,name')
      .eq('qr_public_token', token)
      .single()

    if (restaurantError) {
      console.error('[PDF] Restaurant error:', restaurantError)
      page.drawText(`Errore ristorante: ${restaurantError.message}`, {
        x: 50,
        y: height - 240,
        size: 10,
        color: rgb(1, 0, 0),
      })
    } else if (restaurant) {
      console.log('[PDF] Restaurant found:', restaurant.name)
      page.drawText(`Ristorante: ${restaurant.name}`, {
        x: 50,
        y: height - 240,
        size: 12,
        color: rgb(0.16, 0.11, 0.09),
      })

      console.log('[PDF] Fetching menu:', menuId)
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('id,name,description')
        .eq('id', menuId)
        .eq('restaurant_id', restaurant.id)
        .single()

      if (menuError) {
        console.error('[PDF] Menu error:', menuError)
        page.drawText(`Errore menu: ${menuError.message}`, {
          x: 50,
          y: height - 260,
          size: 10,
          color: rgb(1, 0, 0),
        })
      } else if (menu) {
        console.log('[PDF] Menu found:', menu.name)
        page.drawText(`Nome Menu: ${menu.name}`, {
          x: 50,
          y: height - 260,
          size: 12,
          color: rgb(0.16, 0.11, 0.09),
        })

        console.log('[PDF] Fetching dishes...')
        const { data: dishes, error: dishesError } = await supabase
          .from('dishes')
          .select('id,name,description,price')
          .eq('menu_id', menu.id)
          .limit(5)

        if (dishesError) {
          console.error('[PDF] Dishes error:', dishesError)
          page.drawText(`Errore piatti: ${dishesError.message}`, {
            x: 50,
            y: height - 280,
            size: 10,
            color: rgb(1, 0, 0),
          })
        } else {
          console.log('[PDF] Dishes found:', dishes?.length)
          page.drawText(`Piatti trovati: ${dishes?.length || 0}`, {
            x: 50,
            y: height - 280,
            size: 12,
            color: rgb(0.16, 0.11, 0.09),
          })

          let yPos = height - 320
          if (dishes && dishes.length > 0) {
            for (const dish of dishes.slice(0, 3)) {
              page.drawText(`- ${dish.name} (€${dish.price || 0})`, {
                x: 70,
                y: yPos,
                size: 10,
                color: rgb(0.36, 0.29, 0.22),
              })
              yPos -= 20
            }
          }
        }
      }
    }

    console.log('[PDF] Saving PDF...')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF] PDF saved, size:', pdfBytes.length, 'bytes')

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="menu.pdf"`,
      },
    })
  } catch (error) {
    console.error('[PDF] CRITICAL ERROR:', error)
    return new Response(
      JSON.stringify({
        error: String(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
