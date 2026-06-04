import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: always use getUser(), never getSession() on server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAdminArea =
    path.startsWith('/admin') && !path.startsWith('/admin/login')

  // /admin/* 보호: 비로그인은 login으로, 로그인했어도 is_admin이 아니면 홈으로.
  // 서버 액션의 requireAdmin() 가드와 이중화하여 일반 회원의 admin 페이지 렌더링도 차단합니다.
  if (isAdminArea) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // 로그인 상태에서 /admin/login 진입 시 admin/posts로 보내기.
  // 단, 로그인은 됐지만 is_admin이 아닌 사용자는 그대로 login 페이지에 남겨 혼선을 줄입니다.
  if (path === '/admin/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/posts'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
