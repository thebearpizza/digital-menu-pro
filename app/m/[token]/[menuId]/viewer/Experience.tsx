'use client'

import { Environment, Float, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { Book } from './Book'

function GradientBackground() {
  const { scene } = useThree()

  useEffect(() => {
    const colorTop = new THREE.Color('#2a140f')
    const colorBottom = new THREE.Color('#120907')
    const skyGeo = new THREE.SphereGeometry(100, 32, 32)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: colorTop },
        bottomColor: { value: colorBottom },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(skyGeo, skyMat)
    scene.background = null
    scene.add(mesh)

    return () => {
      scene.remove(mesh)
      skyGeo.dispose()
      skyMat.dispose()
    }
  }, [scene])

  return null
}

export function Experience() {
  return (
    <>
      <GradientBackground />
      <Float rotation-x={-Math.PI / 6} floatIntensity={0.35} speed={1.2} rotationIntensity={0.4}>
        <Book />
      </Float>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 2.4}
        maxPolarAngle={Math.PI / 1.9}
      />
      <Environment preset="studio" />
      <directionalLight
        position={[2, 5, 2]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <ambientLight intensity={0.85} />
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.18} />
      </mesh>
    </>
  )
}
