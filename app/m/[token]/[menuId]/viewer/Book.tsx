'use client'

import { useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useAtom } from 'jotai'
import { easing } from 'maath'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bone,
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { degToRad } from 'three/src/math/MathUtils.js'
import { pageAtom, viewerPagesAtom } from './menu-book-state'
import type { ViewerPage } from './menu-to-pages'

const easingFactor = 0.5
const easingFactorFold = 0.3
const insideCurveStrength = 0.18
const outsideCurveStrength = 0.05
const turningCurveStrength = 0.09

const PAGE_WIDTH = 1.28
const PAGE_HEIGHT = 1.71
const PAGE_DEPTH = 0.003
const PAGE_SEGMENTS = 30
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

const whiteColor = new Color('#f5efe4')
const darkEdgeColor = new Color('#2a1d16')
const coverColor = new Color('#d9c2a0')
const pageColor = new Color('#f8f1e4')
const accentColor = new Color('#c49b69')

const pageGeometry = new BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2)
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0)

const position = pageGeometry.attributes.position
const vertex = new Vector3()
const skinIndexes: number[] = []
const skinWeights: number[] = []

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i)
  const x = vertex.x
  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH))
  const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH

  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0)
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0)
}

pageGeometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndexes, 4))
pageGeometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))

const baseMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: darkEdgeColor }),
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
]

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = ctx.measureText(test).width

    if (width <= maxWidth) {
      current = test
      continue
    }

    if (current) lines.push(current)
    current = word

    if (lines.length === maxLines - 1) break
  }

  if (current && lines.length < maxLines) {
    lines.push(current)
  }

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length
  if (consumedWords < words.length && lines.length > 0) {
    let last = lines[lines.length - 1]
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1)
    }
    lines[lines.length - 1] = `${last.trim()}…`
  }

  return lines
}

function drawWrappedAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  maxLines: number,
  lineHeight: number
) {
  const lines = wrapText(ctx, text, maxWidth, maxLines)
  let y = startY
  for (const line of lines) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
}

function createPageTexture(pageData: ViewerPage, side: 'front' | 'back') {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 1900

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const isCover = pageData.kind === 'cover'
  const isBack = pageData.kind === 'back'
  const pageBg = isCover || isBack ? '#efe0ca' : '#f8f1e4'
  const panelBg = '#fffaf3'
  const ink = '#2a1d16'
  const softInk = '#6b5b4b'
  const accent = '#b98a58'
  const border = '#e1d3bf'

  ctx.fillStyle = pageBg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#eadfce'
  ctx.lineWidth = 3
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

  const marginX = 110
  let y = 140

  const drawLabel = (text: string) => {
    ctx.fillStyle = accent
    ctx.font = '500 34px Inter, Arial, sans-serif'
    ctx.fillText(text.toUpperCase(), marginX, y)
    y += 76
  }

  const drawTitle = (text: string, maxWidth = 1120) => {
    ctx.fillStyle = ink
    ctx.font = '700 92px Inter, Arial, sans-serif'
    const lines = wrapText(ctx, text, maxWidth, 2)
    for (const line of lines) {
      ctx.fillText(line, marginX, y)
      y += 104
    }
    y += 12
  }

  const drawParagraph = (
    text: string,
    opts?: { maxLines?: number; size?: number; color?: string; width?: number }
  ) => {
    ctx.fillStyle = opts?.color ?? softInk
    const size = opts?.size ?? 38
    const maxWidth = opts?.width ?? 1120
    const maxLines = opts?.maxLines ?? 3
    ctx.font = `400 ${size}px Inter, Arial, sans-serif`
    const lines = wrapText(ctx, text, maxWidth, maxLines)
    for (const line of lines) {
      ctx.fillText(line, marginX, y)
      y += size + 20
    }
    y += 12
  }

  if (pageData.kind === 'cover') {
    drawLabel('Menu')
    drawTitle(pageData.title)
    if (pageData.subtitle) {
      drawParagraph(pageData.subtitle, { maxLines: 3, size: 42, color: softInk, width: 980 })
    }

    ctx.fillStyle = panelBg
    roundRect(ctx, marginX, 1220, 1020, 380, 44)
    ctx.fill()

    ctx.strokeStyle = border
    ctx.lineWidth = 2
    roundRect(ctx, marginX, 1220, 1020, 380, 44)
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.font = '600 30px Inter, Arial, sans-serif'
    ctx.fillText('ESPERIENZA 3D', marginX + 52, 1310)

    ctx.fillStyle = ink
    ctx.font = '600 54px Inter, Arial, sans-serif'
    ctx.fillText('Sfoglia il menu digitale', marginX + 52, 1405)

    ctx.fillStyle = softInk
    ctx.font = '400 34px Inter, Arial, sans-serif'
    const lines = wrapText(
      ctx,
      'Tocca le pagine per sfogliare il volantino e usa i tab in basso per saltare rapidamente tra le categorie.',
      920,
      4
    )
    let textY = 1485
    for (const line of lines) {
      ctx.fillText(line, marginX + 52, textY)
      textY += 52
    }
  } else if (pageData.kind === 'category') {
    drawLabel('Categoria')
    drawTitle(pageData.title)
    if (pageData.subtitle) {
      drawParagraph(pageData.subtitle, { maxLines: 2, size: 42 })
    }

    ctx.strokeStyle = border
    ctx.lineWidth = 2
    roundRect(ctx, marginX, 980, 1040, 520, 50)
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.font = '600 32px Inter, Arial, sans-serif'
    ctx.fillText('SEZIONE MENU', marginX + 56, 1080)

    ctx.fillStyle = softInk
    ctx.font = '400 38px Inter, Arial, sans-serif'
    drawWrappedAt(
      ctx,
      `Scopri la selezione ${pageData.title.toLowerCase()} nel volantino.`,
      marginX + 56,
      1185,
      920,
      3,
      56
    )
  } else if (pageData.kind === 'items') {
    drawLabel(pageData.category || 'Selezione')
    drawTitle(pageData.title, 980)

    if (pageData.subtitle) {
      drawParagraph(pageData.subtitle, { maxLines: 1, size: 32, color: accent })
    }

    y += 12

    for (const item of pageData.items ?? []) {
      if (y > 1620) break

      ctx.strokeStyle = border
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(marginX, y + 12)
      ctx.lineTo(canvas.width - marginX, y + 12)
      ctx.stroke()

      y += 62

      ctx.fillStyle = ink
      ctx.font = '600 44px Inter, Arial, sans-serif'
      const nameLines = wrapText(ctx, item.name, 760, 2)
      for (const line of nameLines) {
        ctx.fillText(line, marginX, y)
        y += 52
      }

      if (typeof item.price === 'number') {
        ctx.textAlign = 'right'
        ctx.fillStyle = ink
        ctx.font = '700 42px Inter, Arial, sans-serif'
        ctx.fillText(`€ ${item.price.toFixed(2)}`, canvas.width - marginX, y - 8)
        ctx.textAlign = 'left'
      }

      if (item.description) {
        ctx.fillStyle = softInk
        ctx.font = '400 30px Inter, Arial, sans-serif'
        const descLines = wrapText(ctx, item.description, 980, 3)
        for (const line of descLines) {
          ctx.fillText(line, marginX, y)
          y += 42
        }
      }

      if (item.allergens?.length) {
        ctx.fillStyle = accent
        ctx.font = '500 24px Inter, Arial, sans-serif'
        const allergensText = item.allergens.join(' • ')
        const allergenLines = wrapText(ctx, allergensText, 980, 1)
        for (const line of allergenLines) {
          ctx.fillText(line.toUpperCase(), marginX, y + 8)
          y += 34
        }
      }

      y += 28
    }
  } else if (pageData.kind === 'back') {
    drawLabel('Grazie')
    drawTitle(pageData.title)
    if (pageData.subtitle) {
      drawParagraph(pageData.subtitle, { maxLines: 2, size: 42 })
    }

    ctx.fillStyle = panelBg
    roundRect(ctx, marginX, 1200, 1040, 300, 40)
    ctx.fill()

    ctx.strokeStyle = border
    ctx.lineWidth = 2
    roundRect(ctx, marginX, 1200, 1040, 300, 40)
    ctx.stroke()

    ctx.fillStyle = softInk
    ctx.font = '400 34px Inter, Arial, sans-serif'
    drawWrappedAt(
      ctx,
      'Questo menu digitale è pronto per evolvere con temi, font, banner e impaginazioni personalizzate dal gestionale.',
      marginX + 48,
      1310,
      940,
      4,
      48
    )
  }

  const targetCanvas =
    side === 'back'
      ? (() => {
          const flipped = document.createElement('canvas')
          flipped.width = canvas.width
          flipped.height = canvas.height
          const flippedCtx = flipped.getContext('2d')
          if (!flippedCtx) return canvas
          flippedCtx.translate(flipped.width, 0)
          flippedCtx.scale(-1, 1)
          flippedCtx.drawImage(canvas, 0, 0)
          return flipped
        })()
      : canvas

  const texture = new CanvasTexture(targetCanvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

type PageProps = {
  number: number
  page: number
  opened: boolean
  bookClosed: boolean
  pageData: ViewerPage
  totalPages: number
}

function Page({ number, page, opened, bookClosed, pageData, totalPages }: PageProps) {
  const group = useRef<any>(null)
  const skinnedMeshRef = useRef<any>(null)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)

  const [, setPage] = useAtom(pageAtom)
  const [highlighted, setHighlighted] = useState(false)
  useCursor(highlighted)

  const isCover = number === 0
  const isBack = number === totalPages - 1

  const frontTexture = useMemo(() => createPageTexture(pageData, 'front'), [pageData])
  const backTexture = useMemo(() => createPageTexture(pageData, 'back'), [pageData])

  const manualSkinnedMesh = useMemo(() => {
    const bones: Bone[] = []

    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone()
      bones.push(bone)

      if (i === 0) bone.position.x = 0
      else bone.position.x = SEGMENT_WIDTH

      if (i > 0) bones[i - 1].add(bone)
    }

    const skeleton = new Skeleton(bones)

    const frontColor = isCover || isBack ? coverColor : pageColor
    const backColor = isCover || isBack ? coverColor : pageColor

    const materials = [
      ...baseMaterials,
      new MeshStandardMaterial({
        color: frontColor,
        roughness: isCover || isBack ? 0.92 : 0.98,
        metalness: 0.02,
        emissive: accentColor,
        emissiveIntensity: 0,
        map: frontTexture ?? undefined,
      }),
      new MeshStandardMaterial({
        color: backColor,
        roughness: isCover || isBack ? 0.92 : 0.98,
        metalness: 0.02,
        emissive: accentColor,
        emissiveIntensity: 0,
        map: backTexture ?? undefined,
      }),
    ]

    const mesh = new SkinnedMesh(pageGeometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.add(skeleton.bones[0])
    mesh.bind(skeleton)

    return mesh
  }, [backTexture, frontTexture, isBack, isCover])

  useEffect(() => {
    return () => {
      frontTexture?.dispose()
      backTexture?.dispose()
    }
  }, [frontTexture, backTexture])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) return

    const emissiveIntensity = highlighted ? 0.12 : 0
    const materials = skinnedMeshRef.current.material as MeshStandardMaterial[]

    materials[4].emissiveIntensity = MathUtils.lerp(
      materials[4].emissiveIntensity,
      emissiveIntensity,
      0.1
    )
    materials[5].emissiveIntensity = MathUtils.lerp(
      materials[5].emissiveIntensity,
      emissiveIntensity,
      0.1
    )

    if (lastOpened.current !== opened) {
      turnedAt.current = Date.now()
      lastOpened.current = opened
    }

    let turningTime = Math.min(400, Date.now() - turnedAt.current) / 400
    turningTime = Math.sin(turningTime * Math.PI)

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2
    if (!bookClosed) targetRotation += degToRad(number * 0.8)

    const bones = skinnedMeshRef.current.skeleton.bones

    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i]
      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0
      const turningIntensity = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime

      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation

      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2)

      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation
          foldRotationAngle = 0
        } else {
          rotationAngle = 0
          foldRotationAngle = 0
        }
      }

      easing.dampAngle(target.rotation, 'y', rotationAngle, easingFactor, delta)

      const foldIntensity =
        i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime : 0

      easing.dampAngle(
        target.rotation,
        'x',
        foldRotationAngle * foldIntensity,
        easingFactorFold,
        delta
      )
    }
  })

  return (
    <group
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation()
        setHighlighted(true)
      }}
      onPointerLeave={(e) => {
        e.stopPropagation()
        setHighlighted(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        setPage(opened ? number : number + 1)
        setHighlighted(false)
      }}
    >
      <primitive
        object={manualSkinnedMesh}
        ref={skinnedMeshRef}
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
      />
    </group>
  )
}

export function Book() {
  const [page] = useAtom(pageAtom)
  const [viewerPages] = useAtom(viewerPagesAtom)
  const [delayedPage, setDelayedPage] = useState(page)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    const goToPage = () => {
      setDelayedPage((current) => {
        if (page === current) return current

        timeout = setTimeout(goToPage, Math.abs(page - current) > 2 ? 50 : 150)

        if (page > current) return current + 1
        if (page < current) return current - 1
        return current
      })
    }

    goToPage()

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [page])

  if (!viewerPages.length) return null

  return (
    <group rotation-y={-Math.PI / 2}>
      {viewerPages.map((pageData, index) => (
        <Page
          key={pageData.id}
          page={delayedPage}
          number={index}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === viewerPages.length}
          pageData={pageData}
          totalPages={viewerPages.length}
        />
      ))}
    </group>
  )
}
