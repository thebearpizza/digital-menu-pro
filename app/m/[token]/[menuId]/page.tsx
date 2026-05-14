import { redirect } from 'next/navigation'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

export default function PublicMenuRedirectPage({ params }: PageProps) {
  const { token, menuId } = params

  // PDF temporaneo di test dentro public
  const pdfUrl = `/sample-menu.pdf`

  const viewerUrl = `/flipbook/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
  redirect(viewerUrl)
}
