import { redirect } from 'next/navigation';
import Workspace from '@/components/workspace';
import { demoWorkspace } from '@/lib/demo';
import { emptyWorkspace } from '@/lib/model';
import { backendConfigured } from '@/lib/supabase/config';
import { serverClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your Practice' };
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  const configured = backendConfigured();
  const demo = !configured || params.demo === '1';
  if (!demo) {
    const supabase = await serverClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');
  }
  return <Workspace initial={demo ? demoWorkspace() : emptyWorkspace} demo={demo} />;
}
