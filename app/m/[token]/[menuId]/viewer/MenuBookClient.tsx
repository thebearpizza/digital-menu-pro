'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Html } from '@react-three/drei'
import {
  Bone,
  BoxGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
  Group,
} from 'three'
import { easing } from 'maath'
import { degToRad } from 'three/src/math/MathUtils.js'
import { demoPages } from './data'
import { createPageTexture } from './pageTexture'

const PAGE_WIDTH = 1.25
const PAGE_HEIGHT = 1.72
const PAGE_DEPTH = 0.003
const PAGE_SEGMENTS = 30
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

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

const whiteColor = new Color('white')

function Page({
  index,
  frontCanvas,
  backCanvas,
  opened,
  bookClosed,
}: {
  index: number
  frontCanvas: HTMLCanvasElement
  backCanvas: HTMLCanvasElement
  opened: boolean
  bookClosed: boolean
}) {
  const group = useRef<Group>(null!)
  const skinnedMeshRef = useRef<SkinnedMesh>(null!)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)

  const frontTexture = useMemo(() => {
    const t = new CanvasTexture(frontCanvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [frontCanvas])

  const backTexture = useMemo(() => {
    const t = new CanvasTexture(backCanvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [backCanvas])

  const skinnedMesh = useMemo(() => {
    const bones: Bone[] = []
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone()
      bones.push(bone)
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH
      if (i > 0) bones[i - 1].add(bone)
    }

    const skeleton = new Skeleton(bones)

    const materials = [
      new MeshStandardMaterial({ color: '#ddd4c8' }),
      new MeshStandardMaterial({ color: '#111111' }),
      new MeshStandardMaterial({ color: '#ddd4c8' }),
      new MeshStandardMaterial({ color: '#ddd4c8' }),
      new MeshStandardMaterial({
        color: whiteColor,
        map: frontTexture,
        roughness: 0.95,
        metalness: 0.02,
      }),
      new MeshStandardMaterial({
        color: whiteColor,
        map: backTexture,
        roughness: 0.95,
        metalness: 0.02,
      }),
    ]

    const mesh = new SkinnedMesh(pageGeometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.add(bones[0])
    mesh.bind(skeleton)
    return mesh
  }, [frontTexture, backTexture])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) return

    if (lastOpened.current !== opened) {
      turnedAt.current = Date.now()
      lastOpened.current = opened
    }

    let turningTime = Math.min(400, Date.now() - turnedAt.current) / 400
    turningTime = Math.sin(turningTime * Math.PI)

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2
    if (!bookClosed) {
      targetRotation += degToRad(index * 0.8)
    }

    const bones = skinnedMeshRef.current.skeleton.bones

    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i]

      const insideCurve = 0.18 * (opened ? -1 : 1)
      const outsideCurve = 0.05 * (opened ? 1 : -1)
      const turningCurve =
        Math.sin((i / PAGE_SEGMENTS) * Math.PI) *
        0.09 *
        turningTime *
        (opened ? -1 : 1)

      let rotationAngle = insideCurve + outsideCurve + turningCurve

      if (bookClosed) {
        rotationAngle = 0
      }

      easing.dampAngle(
        target.rotation,
        'y',
        i === 0 ? targetRotation : rotationAngle,
        i === 0 ? 0.5 : 0.3,
        delta
      )
    }
  })

  return (
    <group ref={group}>
      <primitive object={skinnedMesh} ref={skinnedMeshRef} />
    </group>
  )
}

function Book({ currentPage }: { currentPage: number }) {
  const textures = useMemo(() => {
    return demoPages.map((page) => ({
      front: createPageTexture(page.front),
      back: createPageTexture(page.back),
    }))
  }, [])

  return (
    <group position={[0, -0.1, 0]}>
      {textures.map((page, i) => (
        <group key={i} position={[0, 0, -i * 0.003]}>
          <Page
            index={i}
            frontCanvas={page.front}
            backCanvas={page.back}
            opened={currentPage > i}
            bookClosed={currentPage === 0}
          />
        </group>
      ))}
    </group>
  )
}

function Controls({
  currentPage,
  setCurrentPage,
  totalPages,
}: {
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  totalPages: number
}) {
  return (
    <Html fullscreen>
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center gap-4 pb-8">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage <= 0}
          className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57] text-[#1a120d] text-2xl shadow-lg disabled:opacity-30"
        >
          ‹
        </button>
        <div className="rounded-full bg-[#1a120d]/85 px-4 py-2 text-sm text-[#e1c79b] border border-[#6c5232]">
          {currentPage + 1} / {totalPages}
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
          className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57] text-[#1a120d] text-2xl shadow-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </Html>
  )
}

export default function MenuBookClient() {
  const [currentPage, setCurrentPage] = useState(0)

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
      if (dx < 0) setCurrentPage((p) => Math.min(demoPages.length - 1, p + 1))
      else setCurrentPage((p) => Math.max(0, p - 1))
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return (
    <div className="relative h-[100dvh] w-full bg-[#15100c] overflow-hidden">
      <Canvas camera={{ position: [0, 0, 3.6], fov: 42 }} shadows>
        <color attach="background" args={['#15100c']} />
        <ambientLight intensity={1.15} color="#ffe8c8" />
        <directionalLight position={[2, 2, 3]} intensity={1.2} color="#fff3df" castShadow />
        <directionalLight position={[-2, 0, 2]} intensity={0.45} color="#cda97d" />

        <Suspense fallback={null}>
          <Float rotationIntensity={0} floatIntensity={0} speed={0}>
            <Book currentPage={currentPage} />
          </Float>
        </Suspense>

        <Controls
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={demoPages.length}
        />
      </Canvas>
    </div>
  )
}
