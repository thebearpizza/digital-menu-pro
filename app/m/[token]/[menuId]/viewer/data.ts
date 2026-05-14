import type { TexturePageSide } from './pageTexture'

type DemoSpread = {
  front: TexturePageSide
  back: TexturePageSide
}

export const demoPages: DemoSpread[] = [
  {
    front: {
      title: 'Da Zio Roma',
      subtitle: 'Premium Menu',
      body: 'Benvenuto nel nostro menu digitale.',
      tone: 'cover',
    },
    back: {
      title: 'Antipasti',
      subtitle: 'Selezione',
      body: 'Bruschette, supplì, fritti e antipasti della casa.',
      tone: 'inside',
    },
  },
  {
    front: {
      title: 'Pizze',
      subtitle: 'Classiche',
      body: 'Margherita, Napoli, Diavola, Capricciosa.',
      tone: 'inside',
    },
    back: {
      title: 'Pizze',
      subtitle: 'Speciali',
      body: 'Le nostre proposte gourmet e stagionali.',
      tone: 'inside',
    },
  },
  {
    front: {
      title: 'Bevande',
      subtitle: 'Carta drink',
      body: 'Bibite, birre, vini e cocktail.',
      tone: 'inside',
    },
    back: {
      title: 'Grazie',
      subtitle: 'A presto',
      body: 'Scansiona di nuovo il QR per aggiornamenti in tempo reale.',
      tone: 'backcover',
    },
  },
]
