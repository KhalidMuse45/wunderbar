import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { backendConfigured } from '@/lib/supabase/config';
export async function GET(request: NextRequest) {
  const destination = new URL('/login?error=expired', request.url);
  if (backendConfigured()) {
    const client = await serverClient();
    const params = request.nextUrl.searchParams;
    const code = params.get('code');
    const hash = params.get('token_hash');
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL('/practice', request.url));
    } else if (hash && ['email', 'invite'].includes(params.get('type') ?? '')) {
      const { error } = await client.auth.verifyOtp({
        token_hash: hash,
        type: params.get('type') as 'email' | 'invite',
      });
      if (!error) return NextResponse.redirect(new URL('/practice', request.url));
    }
  }
  return NextResponse.redirect(destination);
}
