import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite, type Transaction } from '@electric-sql/pglite';

test('availability and outcome migration upgrades existing data and enforces lifecycle rules', async (t) => {
  const db = new PGlite();
  const a = '20000000-0000-4000-8000-000000000001';
  const b = '20000000-0000-4000-8000-000000000002';
  const admin = '20000000-0000-4000-8000-000000000003';
  const outsider = '20000000-0000-4000-8000-000000000004';
  const asUser = <T>(id: string, work: (tx: Transaction) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      return work(tx);
    });
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`,
    );
    await db.exec(
      await readFile(new URL('../supabase/migrations/001_mvp.sql', import.meta.url), 'utf8'),
    );
    for (const id of [a, b, admin, outsider]) {
      await db.query('insert into auth.users values($1)', [id]);
      await db.query(
        "insert into public.profiles(id,name,onboarded,availability) values($1,'Member',true,'{Mon-09:00}')",
        [id],
      );
    }
    await db.query('insert into private.admins values($1)', [admin]);
    const legacy = (
      await db.query<{ id: string }>(
        "insert into public.sessions(host_id,guest_id,host_name,guest_name,host_role,guest_role,starts_at,focus,question_ids,status) values($1,$2,'A','B','Engineer','Engineer',now()-interval '2 days','Teamwork','{q-1-1}','completed') returning id",
        [a, b],
      )
    ).rows[0].id;
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/002_availability_outcomes.sql', import.meta.url),
        'utf8',
      ),
    );
    await t.test('existing windows and completed sessions survive migration', async () => {
      assert.deepEqual(
        (
          await db.query<{ availability: string[] }>(
            'select availability from profiles where id=$1',
            [a],
          )
        ).rows[0].availability,
        ['Mon-09:00'],
      );
      assert.equal(
        (await db.query<{ status: string }>('select status from sessions where id=$1', [legacy]))
          .rows[0].status,
        'completed',
      );
    });
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 14);
    date.setUTCHours(14, 0, 0, 0);
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
      date,
    );
    // Determine local slots so this remains correct in summer and winter.
    const slot = (zone: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: zone,
      }).formatToParts(date);
      const part = (key: string) => parts.find((p) => p.type === key)?.value;
      return `${part('weekday')}-${part('hour')}:${part('minute')}`;
    };
    const profile = (id: string, timezone: string, slots: string[]) =>
      asUser(id, (tx) =>
        tx.query('update profiles set timezone=$2,availability=$3 where id=$1', [
          id,
          timezone,
          slots,
        ]),
      );
    const match = () =>
      asUser(admin, (tx) =>
        tx.query<{ id: string }>(
          "select public.create_match($1,$2,$3,'Teamwork','','{q-1-1}') as id",
          [a, b, date.toISOString()],
        ),
      );
    let session = '';
    await t.test('Chicago and New York can match at the same instant', async () => {
      await profile(a, 'America/Chicago', [slot('America/Chicago')]);
      await profile(b, 'America/New_York', [slot('America/New_York')]);
      session = (await match()).rows[0].id;
      await assert.rejects(match, /already has a session/);
    });
    await t.test('fractional offsets are valid but malformed slots are rejected', async () => {
      await profile(a, 'UTC', [`${day}-14:00`]);
      await profile(b, 'Asia/Kathmandu', [`${day}-19:45`]);
      await asUser(a, (tx) => tx.query("select public.update_session($1,'cancel')", [session]));
      session = (await match()).rows[0].id;
      await assert.rejects(
        () => profile(b, 'Asia/Kathmandu', [`${day}-19:47`]),
        /valid availability/,
      );
      await assert.rejects(
        () => profile(b, 'Asia/Kathmandu', [`${day}-24:00`]),
        /valid availability/,
      );
    });
    const outcome = (id: string, value: string) =>
      asUser(id, (tx) => tx.query('select public.record_session_outcome($1,$2)', [session, value]));
    const review = (id: string) =>
      asUser(id, (tx) =>
        tx.query("select public.submit_review($1,4,'A clear example.','Add a specific outcome.')", [
          session,
        ]),
      );
    await t.test(
      'future completion, outsider writes, and feedback before completion are rejected',
      async () => {
        await assert.rejects(() => outcome(a, 'completed'), /scheduled hour/);
        await assert.rejects(() => outcome(outsider, 'completed'), /access denied/);
        await assert.rejects(() => review(a), /Record a completed session/);
        await db.query("update sessions set starts_at=now()-interval '2 hours' where id=$1", [
          session,
        ]);
        await assert.rejects(() => review(a), /Record a completed session/);
        await assert.rejects(
          () => asUser(a, (tx) => tx.query("select public.update_session($1,'cancel')", [session])),
          /Record its outcome/,
        );
      },
    );
    await t.test(
      'explicit completion is audited, idempotent, and independent of both reviews',
      async () => {
        await outcome(a, 'completed');
        await outcome(b, 'completed');
        const saved = (
          await db.query<{
            status: string;
            outcome_recorded_by: string;
            outcome_recorded_at: unknown;
          }>('select * from sessions where id=$1', [session])
        ).rows[0];
        assert.equal(saved.status, 'completed');
        assert.equal(saved.outcome_recorded_by, a);
        assert.ok(saved.outcome_recorded_at);
        assert.equal(
          (await db.query('select * from reviews where session_id=$1', [session])).rows.length,
          0,
        );
        await review(a);
        assert.equal(
          (await db.query('select * from reviews where session_id=$1', [session])).rows.length,
          1,
        );
        await review(b);
        assert.equal(
          (await db.query('select * from reviews where session_id=$1', [session])).rows.length,
          2,
        );
        await assert.rejects(() => outcome(b, 'no_show'), /different outcome/);
      },
    );
    await t.test(
      'sessions that did not happen cannot receive feedback and stop pending mail',
      async () => {
        session = (await match()).rows[0].id;
        await db.query("update sessions set starts_at=now()-interval '2 hours' where id=$1", [
          session,
        ]);
        await outcome(b, 'no_show');
        assert.equal(
          (
            await db.query('select * from notifications where session_id=$1 and sent_at is null', [
              session,
            ])
          ).rows.length,
          0,
        );
        await assert.rejects(() => review(a), /Record a completed session/);
        await assert.rejects(() => outcome(a, 'completed'), /different outcome/);
      },
    );
    await t.test(
      'expanded windows are accepted and repeated DST starts are rejected by the database',
      async () => {
        const many = Array.from(
          { length: 32 },
          (_, index) =>
            `Mon-${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
        );
        await profile(a, 'UTC', many);
        const repeated = new Date(Date.UTC(new Date().getUTCFullYear() + 2, 10, 1, 6, 30));
        repeated.setUTCDate(1 + ((7 - repeated.getUTCDay()) % 7));
        date.setTime(repeated.getTime());
        await profile(a, 'UTC', ['Sun-06:30']);
        await profile(b, 'America/New_York', ['Sun-01:30']);
        await assert.rejects(match, /saved availability/);
      },
    );
  } finally {
    await db.close();
  }
});
