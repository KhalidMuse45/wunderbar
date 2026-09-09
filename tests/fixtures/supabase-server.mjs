// Test-only Supabase HTTP contract fixture. The application uses its normal
// server-side auth and workspace routes; no bypass is added to production code.
import { createServer } from 'node:http';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'member@example.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const blankProfile = () => ({
  id: user.id,
  name: '',
  role: 'Software engineer',
  focus: 'Teamwork',
  timezone: 'America/Chicago',
  availability: [],
  skip_weeks: [],
  onboarded: false,
});
let profile = null;
let failSave = false;
let failLoad = false;
let expired = false;
let saves = 0;
let sessions = [];
let reviews = [];

function token() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`;
}

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:3402');
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};

  if (url.pathname === '/health') return send(200, { ready: true });
  if (url.pathname === '/__test/reset' && request.method === 'POST') {
    profile = body.onboarded
      ? { ...blankProfile(), name: 'Returning Member', onboarded: true }
      : null;
    failSave = !!body.failSave;
    failLoad = !!body.failLoad;
    expired = false;
    saves = 0;
    reviews = [];
    sessions = body.session
      ? [
          {
            id: '30000000-0000-4000-8000-000000000001',
            host_id: user.id,
            guest_id: '30000000-0000-4000-8000-000000000002',
            host_name: 'Returning Member',
            guest_name: 'Casey',
            host_role: 'Engineer',
            guest_role: 'Engineer',
            starts_at: new Date(Date.now() - 7200000).toISOString(),
            focus: 'Teamwork',
            meeting_link: '',
            status: 'upcoming',
            question_ids: ['q-1-1'],
          },
        ]
      : [];
    return send(200, { reset: true });
  }
  if (url.pathname === '/__test/state' && request.method === 'GET')
    return send(200, { profile, saves, sessions, reviews });
  if (url.pathname === '/__test/control' && request.method === 'POST') {
    if ('failSave' in body) failSave = body.failSave;
    if ('failLoad' in body) failLoad = body.failLoad;
    if ('expired' in body) expired = body.expired;
    return send(200, { updated: true });
  }
  if (url.pathname === '/auth/v1/verify' && request.method === 'POST') {
    if (body.token_hash !== 'test-invite' || body.type !== 'invite')
      return send(403, { code: 'otp_expired', message: 'Invalid invite.' });
    return send(200, {
      access_token: token(),
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'local-test-refresh-token',
      user,
    });
  }
  if (url.pathname === '/auth/v1/user') {
    if (expired || !request.headers.authorization?.endsWith('.test-signature'))
      return send(401, { code: 'bad_jwt', message: 'Session expired.' });
    return send(200, user);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    if (expired || !request.headers.authorization?.endsWith('.test-signature'))
      return send(401, { message: 'Unauthorized.' });
    if (url.pathname === '/rest/v1/profiles') {
      if (request.method === 'POST') {
        profile = blankProfile();
        return send(201, null);
      }
      if (request.method === 'PATCH') {
        if (failSave) return send(503, { message: 'Temporary database failure.' });
        profile = { ...profile, ...body };
        saves++;
        return send(200, null);
      }
      if (failLoad) return send(500, { message: 'Temporary database failure.' });
      return send(
        200,
        request.headers.accept?.includes('application/vnd.pgrst.object+json')
          ? profile
          : profile
            ? [profile]
            : [],
      );
    }
    if (url.pathname === '/rest/v1/rpc/is_admin') return send(200, false);
    if (url.pathname === '/rest/v1/sessions') return send(200, sessions);
    if (url.pathname === '/rest/v1/reviews') return send(200, reviews);
    if (url.pathname === '/rest/v1/rpc/record_session_outcome') {
      const session = sessions.find((s) => s.id === body.p_session);
      if (!session || !['completed', 'no_show'].includes(body.p_outcome))
        return send(400, { message: 'Invalid outcome.' });
      session.status = body.p_outcome;
      return send(200, null);
    }
    if (url.pathname === '/rest/v1/rpc/submit_review') {
      const session = sessions.find((s) => s.id === body.p_session);
      if (!session || session.status !== 'completed')
        return send(400, { message: 'Record a completed session before leaving feedback.' });
      reviews = [
        {
          id: '40000000-0000-4000-8000-000000000001',
          session_id: session.id,
          reviewer_id: user.id,
          recipient_id: session.guest_id,
          author_name: profile.name,
          score: body.p_score,
          strength: body.p_strength,
          improvement: body.p_improvement,
          created_at: new Date().toISOString(),
        },
      ];
      return send(200, null);
    }

    if (
      request.method === 'GET' &&
      ['sessions', 'stories', 'reviews', 'bookmarks', 'session_notes', 'product_feedback'].includes(
        url.pathname.split('/').at(-1),
      )
    )
      return send(200, []);
  }
  console.error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
  return send(404, { message: 'Unsupported test request.' });
}).listen(3402, '127.0.0.1');
