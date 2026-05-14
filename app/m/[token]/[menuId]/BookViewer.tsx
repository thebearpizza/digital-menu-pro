'use client'

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import {
  Bone,
  BoxGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { degToRad } from 'three/src/math/MathUtils.js'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: string[]
  is_available: boolean
  category: string | null
}

type BookPage = {
  category: string
  dishes: Dish[]
}

type Props = {
  dishes: Dish[]
  menuName: string
  restaurantName: string
}

const PAGE_WIDTH = 1.28
const PAGE_HEIGHT = 1.71
const PAGE_DEPTH = 0.0022
const COVER_DEPTH = 0.05
const SPINE_WIDTH = 0.08
const PAGE_SEGMENTS = 24
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

const TURN_SPEED = 0.22
const FOLD_SPEED = 0.18

const INNER_CURVE = 0.045
const OUTER_CURVE = 0.015
const TURN_CURVE = 0.055

const MAX_ITEMS = 5

const paperWhite = new Color('#f5efe4')
const coverColor = new Color('#2a1d16')
const goldColor = new Color('#b08d57')

const pageGeometry = new BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2
)
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0)

const position = pageGeometry.attributes.position
const vertex = new Vector3()
const skinIndexes: number[] = []
const skinWeights: number[] = []

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position as any, i)
  const x = vertex.x
  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH))
  const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH
  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0)
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0)
}

pageGeometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndexes, 4))
pageGeometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))

const sideMaterial = new MeshStandardMaterial({
  color: '#d8cfbf',
  roughness: 0.95,
  metalness: 0,
})

function buildPageTexture(
  page: BookPage,
  menuName: string,
  restaurantName: string,
  kind: 'cover' | 'inside' | 'backcover'
): HTMLCanvasElement {
  const W = 1024
  const H = 1365
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  if (kind === 'cover' || kind === 'backcover') {
    ctx.fillStyle = '#241811'
    ctx.fillRect(0, 0, W, H)

    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#34241b')
    g.addColorStop(0.5, '#241811')
    g.addColorStop(1, '#1a120d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = '#8d6a3b'
    ctx.lineWidth = 4
    ctx.strokeRect(40, 40, W - 80, H - 80)

    ctx.strokeStyle = '#6e522f'
    ctx.lineWidth = 1
    ctx.strokeRect(62, 62, W - 124, H - 124)

    if (kind === 'cover') {
      ctx.fillStyle = '#b08d57'
      ctx.textAlign = 'center'
      ctx.font = 'bold 70px Georgia, serif'
      ctx.fillText(restaurantName, W / 2, 380)

      ctx.font = '36px Georgia, serif'
      ctx.fillStyle = '#dbc49a'
      ctx.fillText(menuName, W / 2, 470)

      ctx.beginPath()
      ctx.moveTo(W / 2 - 180, 540)
      ctx.lineTo(W / 2 + 180, 540)
      ctx.strokeStyle = '#8d6a3b'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = '28px Georgia, serif'
      ctx.fillStyle = '#8d6a3b'
      ctx.fillText('MENU', W / 2, 610)
    } else {
      ctx.fillStyle = '#8d6a3b'
      ctx.textAlign = 'center'
      ctx.font = '28px Georgia, serif'
      ctx.fillText(restaurantName, W / 2, H - 110)
    }

    return canvas
  }

  ctx.fillStyle = '#f5efe4'
  ctx.fillRect(0, 0, W, H)

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#fbf8f1')
  g.addColorStop(1, '#efe5d6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#5e4733'
  ctx.textAlign = 'center'
  ctx.font = 'bold 34px Georgia, serif'
  ctx.fillText(page.category.toUpperCase(), W / 2, 80)

  ctx.strokeStyle = '#b08d57'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(90, 105)
  ctx.lineTo(W - 90, 105)
  ctx.stroke()

  ctx.fillStyle = '#9b8063'
  ctx.font = '18px Arial, sans-serif'
  ctx.fillText(restaurantName, W / 2, 140)

  let y = 205
  ctx.textAlign = 'left'

  for (const dish of page.dishes) {
    if (y > H - 120) break

    ctx.fillStyle = '#241811'
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillText(dish.name, 90, y)

    if (dish.price != null) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#5e4733'
      ctx.font = '24px Arial, sans-serif'
      ctx.fillText(`€ ${dish.price.toFixed(2)}`, W - 90, y)
      ctx.textAlign = 'left'
    }

    y += 42

    if (dish.description) {
      ctx.fillStyle = '#7a6755'
      ctx.font = '20px Arial, sans-serif'
      const words = dish.description.split(' ')
      const maxWidth = W - 180
      let line = ''
      for (const word of words) {
        const test = line + word + ' '
        if (ctx.measureText(test).width > maxWidth && line.length > 0) {
          ctx.fillText(line.trim(), 90, y)
          line = word + ' '
          y += 28
          if (y > H - 120) break
        } else {
          line = test
        }
      }
      if (line.trim() && y <= H - 120) {
        ctx.fillText(line.trim(), 90, y)
        y += 28
      }
    }

    if (dish.allergens?.length && y <= H - 120) {
      ctx.fillStyle = '#9d7042'
      ctx.font = '16px Arial, sans-serif'
      ctx.fillText(dish.allergens.join(' • '), 90, y)
      y += 24
    }

    y += 10
    ctx.strokeStyle = '#dccfbf'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(90, y)
    ctx.lineTo(W - 90, y)
    ctx.stroke()
    y += 28
  }

  return canvas
}

type PageProps = {
  number: number
  front: HTMLCanvasElement
  back: HTMLCanvasElement
  page: number
  opened: boolean
  bookClosed: boolean
  isCover?: boolean
  isBackCover?: boolean
}

function Page({
  number,
  front,
  back,
  page,
  opened,
  bookClosed,
  isCover = false,
  isBackCover = false,
}: PageProps) {
  const group = useRef<Group>(null!)
  const skinnedMeshRef = useRef<SkinnedMesh>(null!)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)

  const frontTexture = useMemo(() => {
    const t = new CanvasTexture(front)
    t.colorSpace = SRGBColorSpace
    return t
  }, [front])

  const backTexture = useMemo(() => {
    const t = new CanvasTexture(back)
    t.colorSpace = SRGBColorSpace
    return t
  }, [back])

  const manualSkinnedMesh = useMemo(() => {
    const bones: Bone[] = []
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone()
      bones.push(bone)
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH
      if (i > 0) bones[i - 1].add(bone)
    }

    const skeleton = new Skeleton(bones)

    const frontMat = new MeshStandardMaterial({
      color: isCover || isBackCover ? coverColor : paperWhite,
      map: frontTexture,
      roughness: isCover || isBackCover ? 0.85 : 0.95,
      metalness: 0.02,
    })

    const backMat = new MeshStandardMaterial({
      color: isCover || isBackCover ? coverColor : paperWhite,
      map: backTexture,
      roughness: isCover || isBackCover ? 0.85 : 0.95,
      metalness: 0.02,
    })

    const materials = [
      sideMaterial,
      sideMaterial,
      sideMaterial,
      sideMaterial,
      frontMat,
      backMat,
    ]

    const mesh = new SkinnedMesh(pageGeometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.add(bones[0])
    mesh.bind(skeleton)
    return mesh
  }, [frontTexture, backTexture, isCover, isBackCover])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) return

    if (lastOpened.current !== opened) {
      turnedAt.current = Date.now()
      lastOpened.current = opened
    }

    let turningTime = Math.min(300, Date.now() - turnedAt.current) / 300
    turningTime = Math.sin(turningTime * Math.PI)

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2

    if (!bookClosed) {
      targetRotation += degToRad(number * 0.35)
    }

    const bones = skinnedMeshRef.current.skeleton.bones

    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i]

      const insideCurve = INNER_CURVE * (opened ? -1 : 1)
      const outsideCurve = OUTER_CURVE * (opened ? 1 : -1)
      const turningCurve =
        Math.sin((i / PAGE_SEGMENTS) * Math.PI) *
        TURN_CURVE *
        turningTime *
        (opened ? -1 : 1)

      let rotationAngle = insideCurve + outsideCurve + turningCurve

      if (isCover || isBackCover) {
        rotationAngle *= 0.25
      }

      if (bookClosed) {
        rotationAngle = 0
      }

      easing.dampAngle(
        target.rotation,
        'y',
        i === 0 ? targetRotation : rotationAngle,
        i === 0 ? TURN_SPEED : FOLD_SPEED,
        delta
      )
    }
  })

  return <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} />
}

type BookProps = {
  pages: BookPage[]
  menuName: string
  restaurantName: string
  currentPage: number
}

function Book({ pages: bookPages, menuName, restaurantName, currentPage }: BookProps) {
  const groupRef = useRef<Group>(null!)
  const frontCoverRef = useRef<Mesh>(null!)
  const backCoverRef = useRef<Mesh>(null!)
  const spineRef = useRef<Mesh>(null!)

  const textures = useMemo(() => {
    const cover = buildPageTexture(
      { category: '', dishes: [] },
      menuName,
      restaurantName,
      'cover'
    )

    const insidePages = bookPages.map((p) =>
      buildPageTexture(p, menuName, restaurantName, 'inside')
    )

    const backCover = buildPageTexture(
      { category: '', dishes: [] },
      menuName,
      restaurantName,
      'backcover'
    )

    return [cover, ...insidePages, backCover]
  }, [bookPages, menuName, restaurantName])

  const totalSheets = textures.length - 1

  useFrame((_, delta) => {
    if (!groupRef.current || !frontCoverRef.current || !backCoverRef.current || !spineRef.current) return

    easing.dampE(groupRef.current.rotation, [0, -0.95, 0], 0.2, delta)

    easing.damp3(groupRef.current.position, [0, -0.02, 0], 0.2, delta)

    const openFactor = currentPage > 0 ? 1 : 0

    easing.dampAngle(frontCoverRef.current.rotation, 'y', openFactor ? -Math.PI / 2 : 0, 0.18, delta)
    easing.dampAngle(backCoverRef.current.rotation, 'y', 0, 0.18, delta)
    easing.damp3(spineRef.current.position, [0, 0, 0], 0.2, delta)
  })

  return (
    <group ref={groupRef}>
      {/* back cover */}
      <mesh ref={backCoverRef} position={[0, 0, -0.04]} castShadow receiveShadow>
        <boxGeometry args={[PAGE_WIDTH + 0.02, PAGE_HEIGHT + 0.04, COVER_DEPTH]} />
        <meshStandardMaterial color="#251912" roughness={0.88} metalness={0.03} />
      </mesh>

      {/* spine */}
      <mesh ref={spineRef} position={[-0.04, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[SPINE_WIDTH, PAGE_HEIGHT + 0.03, COVER_DEPTH + 0.01]} />
        <meshStandardMaterial color="#1a120d" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* front hard cover */}
      <mesh ref={frontCoverRef} position={[PAGE_WIDTH / 2, 0, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[PAGE_WIDTH + 0.02, PAGE_HEIGHT + 0.04, COVER_DEPTH]} />
        <meshStandardMaterial color="#2a1d16" roughness={0.88} metalness={0.03} />
      </mesh>

      {/* internal sheets */}
      {textures.slice(0, -1).map((frontCanvas, i) => {
        const zOffset = 0.01 - i * 0.0015
        return (
          <group key={i} position={[0, 0, zOffset]}>
            <Page
              number={i}
              front={frontCanvas}
              back={textures[i + 1]}
              page={currentPage}
              opened={currentPage > i}
              bookClosed={currentPage === 0}
              isCover={i === 0}
              isBackCover={i === totalSheets - 1}
            />
          </group>
        )
      })}
    </group>
  )
}

type NavUIProps = {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function NavUI({ currentPage, totalPages, onPrev, onNext }: NavUIProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-end justify-center gap-5 pb-8">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentPage <= 0}
        className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57]/90 text-[#1b120d] text-2xl shadow-lg disabled:opacity-30"
        aria-label="Pagina precedente"
      >
        ‹
      </button>
      <div className="pointer-events-none rounded-full border border-[#6e522f]/50 bg-[#1b120d]/80 px-4 py-2 text-sm text-[#d7bf96]">
        {currentPage} / {Math.max(0, totalPages - 1)}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={currentPage >= totalPages - 1}
        className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57]/90 text-[#1b120d] text-2xl shadow-lg disabled:opacity-30"
        aria-label="Pagina successiva"
      >
        ›
      </button>
    </div>
  )
}

export default function BookViewer({ dishes, menuName, restaurantName }: Props) {
  const [currentPage, setCurrentPage] = useState(0)

  const bookPages = useMemo<BookPage[]>(() => {
    const byCategory = new Map<string, Dish[]>()

    for (const dish of dishes) {
      const cat = dish.category || 'Varie'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(dish)
    }

    const result: BookPage[] = []
    byCategory.forEach((list, cat) => {
      if (list.length <= MAX_ITEMS) {
        result.push({ category: cat, dishes: list })
      } else {
        for (let i = 0; i < list.length; i += MAX_ITEMS) {
          const slice = list.slice(i, i + MAX_ITEMS)
          const label = i === 0 ? cat : `${cat} (${Math.floor(i / MAX_ITEMS) + 1})`
          result.push({ category: label, dishes: slice })
        }
      }
    })

    if (result.length === 0) {
      result.push({ category: 'Menu', dishes: [] })
    }

    result.sort((a, b) => a.category.localeCompare(b.category))
    return result
  }, [dishes])

  const totalPages = bookPages.length + 2

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
  }, [totalPages])

  useEffect(() => {
    let startX: number | null = null

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (startX == null) return
      const dx = e.changedTouches[0].clientX - startX
      startX = null

      if (Math.abs(dx) < 40) return
      if (dx < 0) handleNext()
      else handlePrev()
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleNext, handlePrev])

  return (
    <div className="relative h-[100dvh] w-full bg-[#15100c]">
      <Canvas
        shadows
        camera={{ position: [0.8, 0.15, 3.2], fov: 35 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#15100c']} />
        <fog attach="fog" args={['#15100c', 6, 14]} />
        <ambientLight intensity={0.6} color="#ffe7c4" />
        <directionalLight
          position={[3, 4, 4]}
          intensity={1.3}
          color="#fff2dc"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-2, 1, 2]} intensity={0.45} color="#caa77a" />
        <spotLight
          position={[0, 5, 3]}
          angle={0.45}
          penumbra={0.5}
          intensity={0.7}
          color="#fff0d6"
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <shadowMaterial opacity={0.22} />
        </mesh>

        <Book
          pages={bookPages}
          menuName={menuName}
          restaurantName={restaurantName}
          currentPage={currentPage}
        />
      </Canvas>

      <NavUI
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  )
}
