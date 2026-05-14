import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { menuId: string } }
) {
  return new NextResponse(`PDF route pronta per menu ${params.menuId}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
