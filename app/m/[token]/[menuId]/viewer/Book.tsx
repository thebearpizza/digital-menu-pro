'use client'

import { useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useAtom } from 'jotai'
import { easing } from 'maath'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { degToRad } from 'three/src/math/MathUtils.js'
import { pageAtom, pages } from './menu-book-state'

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
const emissiveColor = new Color('#c58a3a')

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

type PageProps = {
  number: number
  page: number
  opened: boolean
  bookClosed: boolean
}

function Page({ number, page, opened, bookClosed }: PageProps) {
  const group = useRef<any>(null)
  const skinnedMeshRef = useRef<any>(null)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)

  const [_, setPage] = useAtom(pageAtom)
  const [highlighted, setHighlighted] = useState(false)
  useCursor(highlighted)

  const isCover = number === 0
  const isBack = number === pages.length - 1

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
        roughness: isCover || isBack ? 0.9 : 0.95,
        metalness: 0.02,
        emissive: accentColor,
        emissiveIntensity: 0,
      }),
      new MeshStandardMaterial({
        color: backColor,
        roughness: isCover || isBack ? 0.9 : 0.95,
        metalness: 0.02,
        emissive: accentColor,
        emissiveIntensity: 0,
      }),
    ]

    const mesh = new SkinnedMesh(pageGeometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.add(skeleton.bones[0])
    mesh.bind(skeleton)

    return mesh
  }, [isCover, isBack])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) return

    const emissiveIntensity = highlighted ? 0.18 : 0
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

  return (
    <group rotation-y={-Math.PI / 2}>
      {pages.map((_, index) => (
        <Page
          key={index}
          page={delayedPage}
          number={index}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
        />
      ))}
    </group>
  )
}
