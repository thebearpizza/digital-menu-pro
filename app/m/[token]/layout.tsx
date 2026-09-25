import LitoSplash from '@/components/LitoSplash'

export default function PublicMenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LitoSplash />
    </>
  )
}
