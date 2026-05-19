'use client'

import { Canvas } from '@react-three/fiber'
import { Experience } from './Experience'
import { Suspense } from 'react'
import DishModal from './DishModal'

export default function Canvas3D() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
      <DishModal />
    </>
  )
}
