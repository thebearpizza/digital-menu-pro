// Client-side background removal for uploaded logos: samples the corner
// pixels to detect a uniform background color, then makes matching pixels
// transparent (with a soft falloff at edges for anti-aliasing). Produces a
// real alpha-channel cutout so the logo fuses cleanly with any landing
// background, regardless of the chosen CSS blend mode.
export async function removeUniformBackground(file: File): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = imageData.data

  const corners = [
    [0, 0], [canvas.width - 1, 0],
    [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1],
  ]
  let r = 0, g = 0, b = 0, a = 0
  for (const [x, y] of corners) {
    const i = (y * canvas.width + x) * 4
    r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3]
  }
  r /= corners.length; g /= corners.length; b /= corners.length; a /= corners.length

  // Already transparent at the corners — nothing to remove.
  if (a < 10) return file

  const threshold = 32
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - r, dg = px[i + 1] - g, db = px[i + 2] - b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist < threshold) px[i + 3] = 0
    else if (dist < threshold * 2) px[i + 3] = Math.round(px[i + 3] * (dist - threshold) / threshold)
  }

  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
