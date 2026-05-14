import { redirect } from 'next/navigation'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

export default function PublicMenuPage(_props: PageProps) {
  redirect('/flipbook-test')
}
