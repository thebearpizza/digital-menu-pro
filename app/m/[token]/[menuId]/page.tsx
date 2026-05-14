import { redirect } from 'next/navigation'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

export default function PublicMenuRedirectPage({ params }: PageProps) {
  const pdfUrl = `/api/menus/${params.menuId}/pdf`
  const viewerUrl = `/flipbook/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
  redirect(viewerUrl)
}
