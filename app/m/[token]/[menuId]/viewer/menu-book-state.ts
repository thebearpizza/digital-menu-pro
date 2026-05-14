import { atom } from 'jotai'
import type { ViewerPage } from './menu-to-pages'

export const pageAtom = atom(0)
export const viewerPagesAtom = atom<ViewerPage[]>([])

export const pages: ViewerPage[] = [
  { id: 'cover', label: 'Cover', kind: 'cover', title: 'Cover' },
  { id: 'back', label: 'Back', kind: 'back', title: 'Back' },
]
