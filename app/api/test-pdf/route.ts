import { PDFDocument, rgb } from 'pdf-lib'

export async function GET() {
  try {
    console.log('[TEST-PDF] Starting test PDF generation')

    const pdfDoc = await PDFDocument.create()
    console.log('[TEST-PDF] PDF created')

    const page = pdfDoc.addPage([595, 842])
    const { height, width } = page.getSize()

    page.drawText('Test PDF', {
      x: 50,
      y: height - 100,
      size: 48,
      color: rgb(0.16, 0.11, 0.09),
    })

    page.drawText('If you see this, PDF generation works!', {
      x: 50,
      y: height - 200,
      size: 16,
      color: rgb(0.36, 0.29, 0.22),
    })

    const pdfBytes = await pdfDoc.save()
    console.log('[TEST-PDF] PDF saved, size:', pdfBytes.length)

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="test.pdf"',
      },
    })
  } catch (error) {
    console.error('[TEST-PDF] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
