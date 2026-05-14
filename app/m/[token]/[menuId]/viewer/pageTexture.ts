export type TexturePageSide = {
  title: string
  subtitle: string
  body: string
  tone: 'cover' | 'inside' | 'backcover'
}

export function createPageTexture(side: TexturePageSide): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1400
  const ctx = canvas.getContext('2d')!

  if (side.tone === 'cover' || side.tone === 'backcover') {
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    bg.addColorStop(0, '#2a1d16')
    bg.addColorStop(0.6, '#1c130e')
    bg.addColorStop(1, '#120c09')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = '#9e7a47'
    ctx.lineWidth = 6
    ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96)

    ctx.strokeStyle = '#5f4528'
    ctx.lineWidth = 2
    ctx.strokeRect(76, 76, canvas.width - 152, canvas.height - 152)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#d6ba8a'
    ctx.font = 'bold 78px Georgia, serif'
    ctx.fillText(side.title, canvas.width / 2, 420)

    ctx.fillStyle = '#b7935d'
    ctx.font = '36px Georgia, serif'
    ctx.fillText(side.subtitle, canvas.width / 2, 515)

    ctx.strokeStyle = '#7d5a33'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2 - 170, 585)
    ctx.lineTo(canvas.width / 2 + 170, 585)
    ctx.stroke()

    ctx.fillStyle = '#8f6d43'
    ctx.font = '28px Arial, sans-serif'
    wrapText(ctx, side.body, canvas.width / 2, 700, 620, 42, true)
  } else {
    ctx.fillStyle = '#f5efe4'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const paper = ctx.createLinearGradient(0, 0, 0, canvas.height)
    paper.addColorStop(0, '#fbf8f1')
    paper.addColorStop(1, '#efe4d4')
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#8d7355'
    ctx.font = '18px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('DIGITAL MENU', canvas.width / 2, 95)

    ctx.fillStyle = '#2a1d16'
    ctx.font = 'bold 64px Georgia, serif'
    ctx.fillText(side.title, canvas.width / 2, 220)

    ctx.fillStyle = '#a37c4d'
    ctx.font = '30px Arial, sans-serif'
    ctx.fillText(side.subtitle, canvas.width / 2, 285)

    ctx.strokeStyle = '#c9b69c'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(120, 330)
    ctx.lineTo(canvas.width - 120, 330)
    ctx.stroke()

    ctx.fillStyle = '#5b4737'
    ctx.font = '30px Arial, sans-serif'
    wrapText(ctx, side.body, canvas.width / 2, 450, 700, 44, true)

    ctx.fillStyle = '#9d8464'
    ctx.font = '20px Arial, sans-serif'
    ctx.fillText('Menu page', canvas.width / 2, canvas.height - 80)
  }

  return canvas
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  centered = false
) {
  const words = text.split(' ')
  let line = ''
  const lines: string[] = []

  for (const word of words) {
    const test = line + word + ' '
    const width = ctx.measureText(test).width
    if (width > maxWidth && line) {
      lines.push(line.trim())
      line = word + ' '
    } else {
      line = test
    }
  }
  if (line.trim()) lines.push(line.trim())

  for (let i = 0; i < lines.length; i++) {
    ctx.textAlign = centered ? 'center' : 'left'
    ctx.fillText(lines[i], x, y + i * lineHeight)
  }
}
