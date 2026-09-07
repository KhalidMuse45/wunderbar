import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { backendConfigured, backendConfig } from '@/lib/supabase/config';
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!backendConfigured() || request.nextUrl.searchParams.get('demo') === '1') return response;
  const { url, key } = backendConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/practice', '/api/workspace', '/login', '/auth/confirm'] };
