export type PdfDish = {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  sort_order: number | null
  image_url?: string | null
  allergens?: string[] | null
}

export type PdfMenu = {
  id: string
  name: string
  description: string | null
  dishes: PdfDish[]
}

export type PdfPayload = {
  restaurant: {
    id: string
    name: string
  }
  menus: PdfMenu[]
}
