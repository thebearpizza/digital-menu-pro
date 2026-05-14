import { atom } from 'jotai'
import type { ViewerPage } from './menu-to-pages'

export const pageAtom = atom(0)
export const viewerPagesAtom = atom<ViewerPage[]>([])
