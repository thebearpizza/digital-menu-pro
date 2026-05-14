import { atom } from 'jotai'

export type MenuPageTexture = {
  front: string
  back: string
}

export const pageAtom = atom(0)

export const pages: MenuPageTexture[] = [
  { front: 'book-cover', back: 'menu-01' },
  { front: 'menu-02', back: 'menu-03' },
  { front: 'menu-04', back: 'menu-05' },
  { front: 'menu-06', back: 'book-back' },
]
