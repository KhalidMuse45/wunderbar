import { Brand } from '@/components/ui';
import LoginForm from '@/components/login-form';
import { backendConfigured } from '@/lib/supabase/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Make Yourself at Home' };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <Brand />
      <LoginForm configured={backendConfigured()} failed={Boolean(params.error)} />
    </main>
  );
}
