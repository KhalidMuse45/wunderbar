import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') ?? '';
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${secret}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${secret}`))
  )
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emailKey = process.env.RESEND_API_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const from = process.env.EMAIL_FROM;
  if (!url || !serviceKey || !emailKey || !site || !from)
    return NextResponse.json({ error: 'Email delivery is not configured.' }, { status: 503 });
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: jobs, error } = await client.rpc('claim_notifications');
  if (error)
    return NextResponse.json({ error: 'Could not claim due notifications.' }, { status: 500 });
  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      const { data: session, error: sessionError } = await client
        .from('sessions')
        .select('*')
        .eq('id', job.session_id)
        .single();
      if (sessionError || !session) throw new Error('Missing session.');
      // Re-read after claiming so a cancellation suppresses already queued reminders.
      if (
        (session.status === 'cancelled' && job.kind !== 'cancelled') ||
        (['day_before', 'hour_before'].includes(job.kind) &&
          (session.status !== 'upcoming' || Date.parse(session.starts_at) < Date.now()))
      ) {
        await client
          .from('notifications')
          .update({ failed: true, leased_until: null })
          .eq('id', job.id);
        continue;
      }
      if (job.kind === 'feedback') {
        const { count, error: reviewError } = await client
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('reviewer_id', job.user_id);
        if (reviewError) throw reviewError;
        if (count) {
          await client
            .from('notifications')
            .update({ sent_at: new Date().toISOString(), leased_until: null })
            .eq('id', job.id);
          continue;
        }
      }
      const {
        data: { user },
        error: userError,
      } = await client.auth.admin.getUserById(job.user_id);
      if (userError || !user?.email) throw new Error('Missing recipient.');
      const { data: profile } = await client
        .from('profiles')
        .select('timezone')
        .eq('id', job.user_id)
        .single();
      const partner = session.host_id === job.user_id ? session.guest_name : session.host_name;
      const when = new Intl.DateTimeFormat('en-US', {
        timeZone: profile?.timezone ?? 'UTC',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(session.starts_at));
      const subjects: Record<string, string> = {
        confirmed: 'Your next conversation is confirmed',
        day_before: 'A little practice, tomorrow',
        hour_before: 'Your practice starts in an hour',
        feedback: 'One thoughtful note makes a difference',
        cancelled: 'Your practice session was cancelled',
        link_updated: 'Your practice meeting link has changed',
      };
      const text =
        job.kind === 'cancelled'
          ? `Your Wunderbar session with ${partner} on ${when} was cancelled. Visit your workspace to update your availability or contact the administrator about a new time.`
          : `${job.kind === 'feedback' ? 'After your session, leave your partner one specific strength and one thing to try next time.' : `You’re practicing ${session.focus.toLowerCase()} with ${partner} on ${when}. Take turns interviewing and make a little room for feedback.`}\n\n${session.meeting_link ? `Meeting: ${session.meeting_link}\n\n` : 'Your meeting link will appear in your session details once added.\n\n'}Your workspace: ${site.replace(/\/$/, '')}/practice#sessions`;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `wunderbar/${job.id}/${job.delivery_key}`,
        },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: subjects[job.kind],
          text: `${text}\n\nGood things take practice.\nWunderbar`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Email provider rejected delivery.');
      const updated = await client
        .from('notifications')
        .update({ sent_at: new Date().toISOString(), leased_until: null })
        .eq('id', job.id);
      if (updated.error) throw updated.error;
      sent++;
    } catch {
      failed++;
      await client
        .from('notifications')
        .update({
          failed: job.attempts >= 5,
          leased_until: null,
          due_at: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60000).toISOString(),
        })
        .eq('id', job.id);
    }
  }
  return NextResponse.json({ sent, failed });
}
