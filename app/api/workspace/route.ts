import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverClient } from '@/lib/supabase/server';
import { backendConfigured } from '@/lib/supabase/config';
import {
  emptyWorkspace,
  profileSchema,
  storySchema,
  meetingSchema,
  reviewSchema,
  ideaSchema,
  sessionSchema,
  type Workspace,
  type Member,
} from '@/lib/model';
import { questions } from '@/content/questions';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function auth() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return { client, user: error ? null : user };
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return !!origin && origin === request.nextUrl.origin;
}
function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

export async function GET() {
  if (!backendConfigured()) return json({ error: 'Connected accounts are not configured.' }, 503);
  try {
    const { client, user } = await auth();
    if (!user) return json({ error: 'Please sign in.' }, 401);
    const id = user.id;
    let profileResult = await client.from('profiles').select('*').eq('id', id).maybeSingle();
    check(profileResult);
    if (!profileResult.data) {
      const created = await client.from('profiles').insert({ id });
      if (created.error && created.error.code !== '23505') check(created);
      profileResult = await client.from('profiles').select('*').eq('id', id).single();
      check(profileResult);
    }
    const p = profileResult.data;
    const [sessions, stories, reviews, bookmarks, notes, feedback, adminResult] = await Promise.all(
      [
        client
          .from('sessions')
          .select('*')
          .or(`host_id.eq.${id},guest_id.eq.${id}`)
          .order('starts_at', { ascending: false }),
        client
          .from('stories')
          .select('*')
          .eq('user_id', id)
          .order('updated_at', { ascending: false }),
        client
          .from('reviews')
          .select('*')
          .or(`reviewer_id.eq.${id},recipient_id.eq.${id}`)
          .order('created_at', { ascending: false }),
        client.from('bookmarks').select('question_id').eq('user_id', id),
        client.from('session_notes').select('session_id,notes').eq('user_id', id),
        client
          .from('product_feedback')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false }),
        client.rpc('is_admin'),
      ],
    );
    [sessions, stories, reviews, bookmarks, notes, feedback, adminResult].forEach(check);
    const workspace: Workspace = {
      ...emptyWorkspace,
      profile: {
        name: p.name,
        role: p.role,
        focus: p.focus,
        timezone: p.timezone,
        availability: p.availability,
        skipWeeks: p.skip_weeks,
        onboarded: p.onboarded,
      },
      sessions: (sessions.data ?? []).map((s) => ({
        id: s.id,
        partner: s.host_id === id ? s.guest_name : s.host_name,
        partnerRole: s.host_id === id ? s.guest_role : s.host_role,
        startsAt: new Date(s.starts_at).toISOString(),
        timezone: p.timezone,
        focus: s.focus,
        link: s.meeting_link,
        status: s.status,
        questionIds: s.question_ids,
        notes: notes.data?.find((n) => n.session_id === s.id)?.notes ?? {},
      })),
      stories: (stories.data ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        competency: s.competency,
        situation: s.situation,
        task: s.task,
        action: s.action,
        result: s.result,
        date: new Date(s.updated_at).toISOString(),
      })),
      reviews: (reviews.data ?? []).map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        author: r.author_name,
        received: r.recipient_id === id,
        score: r.score,
        strength: r.strength,
        improvement: r.improvement,
      })),
      savedQuestions: (bookmarks.data ?? []).map((b) => b.question_id),
      ideas: (feedback.data ?? []).map((f) => ({
        id: f.id,
        title: f.title,
        body: f.body,
        status: f.status,
        date: new Date(f.created_at).toISOString(),
      })),
    };
    let members: Member[] = [];
    if (adminResult.data === true) {
      const result = await client
        .from('profiles')
        .select('id,name,role,focus,timezone,availability,skip_weeks')
        .eq('onboarded', true)
        .order('name');
      check(result);
      members = (result.data ?? []).map((m) => ({ ...m, skipWeeks: m.skip_weeks }));
    }
    return json({ workspace, admin: adminResult.data === true, members });
  } catch {
    return json(
      { error: 'Your workspace could not be loaded. Check the database setup and try again.' },
      500,
    );
  }
}

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('profile'), profile: profileSchema }),
  z.object({ type: z.literal('story'), story: storySchema }),
  z.object({ type: z.literal('deleteStory'), id: z.string().uuid() }),
  z.object({
    type: z.literal('bookmark'),
    id: z.string().refine((id) => questions.some((q) => q.id === id)),
  }),
  z.object({
    type: z.literal('schedule'),
    session: sessionSchema,
    hostId: z.string().uuid(),
    guestId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('notes'),
    id: z.string().uuid(),
    notes: z.record(z.string().max(10000)).refine((notes) => Object.keys(notes).length <= 7),
  }),
  z.object({ type: z.literal('cancel'), id: z.string().uuid() }),
  z.object({ type: z.literal('link'), id: z.string().uuid(), link: meetingSchema }),
  z.object({
    type: z.literal('review'),
    review: reviewSchema.extend({ sessionId: z.string().uuid() }),
  }),
  z.object({ type: z.literal('idea'), idea: ideaSchema.extend({ id: z.string().uuid() }) }),
]);
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return json({ error: 'This request must come from your Wunderbar workspace.' }, 403);
  if (!backendConfigured()) return json({ error: 'Connected accounts are not configured.' }, 503);
  if (Number(request.headers.get('content-length') ?? 0) > 150000)
    return json({ error: 'That content is too large.' }, 413);
  try {
    const { client, user } = await auth();
    if (!user) return json({ error: 'Please sign in.' }, 401);
    const raw = await request.text();
    if (raw.length > 150000) return json({ error: 'That content is too large.' }, 413);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }
    const parsed = actionSchema.safeParse(value);
    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);
    const a = parsed.data;
    const id = user.id;
    switch (a.type) {
      case 'profile': {
        const p = a.profile;
        check(
          await client
            .from('profiles')
            .update({
              name: p.name,
              role: p.role,
              focus: p.focus,
              timezone: p.timezone,
              availability: p.availability,
              skip_weeks: p.skipWeeks,
              onboarded: p.onboarded,
            })
            .eq('id', id),
        );
        break;
      }
      case 'story': {
        const s = a.story;
        check(
          await client
            .from('stories')
            .upsert(
              {
                id: s.id,
                user_id: id,
                title: s.title,
                competency: s.competency,
                situation: s.situation,
                task: s.task,
                action: s.action,
                result: s.result,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' },
            ),
        );
        break;
      }
      case 'deleteStory':
        check(await client.from('stories').delete().eq('id', a.id).eq('user_id', id));
        break;
      case 'bookmark': {
        const result = await client
          .from('bookmarks')
          .select('question_id')
          .eq('user_id', id)
          .eq('question_id', a.id)
          .maybeSingle();
        check(result);
        check(
          result.data
            ? await client.from('bookmarks').delete().eq('user_id', id).eq('question_id', a.id)
            : await client.from('bookmarks').insert({ user_id: id, question_id: a.id }),
        );
        break;
      }
      case 'schedule': {
        const isAdmin = await client.rpc('is_admin');
        check(isAdmin);
        if (!isAdmin.data) return json({ error: 'Administrator access required.' }, 403);
        const history = await client
          .from('sessions')
          .select('question_ids')
          .eq('status', 'completed')
          .or(`host_id.in.(${a.hostId},${a.guestId}),guest_id.in.(${a.hostId},${a.guestId})`);
        check(history);
        const seen = new Set((history.data ?? []).flatMap((s) => s.question_ids as string[]));
        const candidates = questions.filter(
          (q) => q.competency === a.session.focus && !seen.has(q.id),
        );
        if (!candidates.length)
          return json(
            {
              error:
                'Both members have already practiced the available questions in this topic. Choose another focus.',
            },
            409,
          );
        check(
          await client.rpc('create_match', {
            p_host: a.hostId,
            p_guest: a.guestId,
            p_starts: a.session.startsAt,
            p_focus: a.session.focus,
            p_link: a.session.link,
            p_questions: candidates.slice(0, 3).map((q) => q.id),
          }),
        );
        break;
      }
      case 'notes':
        check(
          await client
            .from('session_notes')
            .upsert(
              { session_id: a.id, user_id: id, notes: a.notes },
              { onConflict: 'session_id,user_id' },
            ),
        );
        break;
      case 'cancel':
        check(await client.rpc('update_session', { p_session: a.id, p_operation: 'cancel' }));
        break;
      case 'link':
        check(
          await client.rpc('update_session', {
            p_session: a.id,
            p_operation: 'link',
            p_link: a.link,
          }),
        );
        break;
      case 'review':
        check(
          await client.rpc('submit_review', {
            p_session: a.review.sessionId,
            p_score: a.review.score,
            p_strength: a.review.strength,
            p_improvement: a.review.improvement,
          }),
        );
        break;
      case 'idea':
        check(
          await client
            .from('product_feedback')
            .insert({ id: a.idea.id, user_id: id, title: a.idea.title, body: a.idea.body }),
        );
        break;
    }
    return json({ success: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : '';
    const safe = [
      'Choose a time within both members’ saved availability.',
      'One member is skipping this week.',
      'A member already has a session at that time.',
      'Both members must finish their profiles.',
      'This session is no longer upcoming.',
      'This session was cancelled.',
      'You can submit feedback after the session starts.',
      'Choose two different members and a future time.',
    ];
    return json(
      {
        error: safe.includes(message)
          ? message
          : 'That change could not be saved. Please check your access and try again.',
      },
      400,
    );
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (!backendConfigured()) return json({ error: 'Connected accounts are not configured.' }, 503);
  const client = await serverClient();
  const { error } = await client.auth.signOut();
  return error ? json({ error: 'Could not sign out.' }, 500) : json({ success: true });
}
