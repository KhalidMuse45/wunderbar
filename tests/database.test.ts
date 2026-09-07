import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite, type Transaction } from '@electric-sql/pglite';
const ids = {
  a: '10000000-0000-4000-8000-000000000001',
  b: '10000000-0000-4000-8000-000000000002',
  c: '10000000-0000-4000-8000-000000000003',
  admin: '10000000-0000-4000-8000-000000000004',
};
test('Postgres migration and member authorization boundaries', async (t) => {
  const db = new PGlite();
  const asUser = <T>(id: string, work: (tx: Transaction) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
      return work(tx);
    });
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`,
    );
    await db.exec(
      await readFile(new URL('../supabase/migrations/001_mvp.sql', import.meta.url), 'utf8'),
    );
    for (const [name, id] of Object.entries(ids)) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}@example.com`]);
      await db.query(
        "insert into public.profiles(id,name,onboarded,timezone,availability) values($1,$2,true,'UTC',ARRAY['Mon-18:00','Tue-18:00','Wed-18:00','Thu-18:00','Fri-18:00','Sat-18:00','Sun-18:00'])",
        [id, name],
      );
    }
    await db.query('insert into private.admins(user_id) values($1)', [ids.admin]);
    await t.test('anonymous requests have no table access', async () => {
      await assert.rejects(
        () =>
          db.transaction(async (tx) => {
            await tx.exec('set local role anon');
            await tx.query('select * from public.profiles');
          }),
        /permission denied/,
      );
    });
    await t.test(
      'members can read only their own profile, and cannot become administrators',
      async () => {
        const rows = await asUser(ids.a, (tx) => tx.query('select id from public.profiles'));
        assert.equal(rows.rows.length, 1);
        const admin = await asUser(ids.a, (tx) =>
          tx.query<{ admin: boolean }>('select public.is_admin() as admin'),
        );
        assert.equal(admin.rows[0].admin, false);
        await assert.rejects(
          () =>
            asUser(ids.a, (tx) =>
              tx.query('insert into private.admins(user_id) values($1)', [ids.a]),
            ),
          /permission denied/,
        );
      },
    );
    await t.test('stories are private even from the matching administrator', async () => {
      await asUser(ids.a, (tx) =>
        tx.query(
          "insert into public.stories(user_id,title,competency) values($1,'My private story','Conflict')",
          [ids.a],
        ),
      );
      assert.equal(
        (await asUser(ids.b, (tx) => tx.query('select * from public.stories'))).rows.length,
        0,
      );
      assert.equal(
        (await asUser(ids.admin, (tx) => tx.query('select * from public.stories'))).rows.length,
        0,
      );
      await assert.rejects(
        () =>
          asUser(ids.b, (tx) =>
            tx.query(
              "insert into public.stories(user_id,title,competency) values($1,'Not mine','Conflict')",
              [ids.a],
            ),
          ),
        /row-level security/,
      );
    });
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 4);
    future.setUTCHours(18, 0, 0, 0);
    const startsAt = future.toISOString();
    const match = (host: string, guest: string, time = startsAt) =>
      asUser(ids.admin, (tx) =>
        tx.query<{ id: string }>(
          "select public.create_match($1,$2,$3,'Teamwork','','{q-1-1,q-1-2}') as id",
          [host, guest, time],
        ),
      );
    await t.test('members cannot approve matches', async () => {
      await assert.rejects(
        () =>
          asUser(ids.a, (tx) =>
            tx.query("select public.create_match($1,$2,$3,'Teamwork','','{q-1-1}')", [
              ids.a,
              ids.b,
              startsAt,
            ]),
          ),
        /Administrator access required/,
      );
    });
    let session = '';
    await t.test('admin approval creates one session and durable notifications', async () => {
      session = (await match(ids.a, ids.b)).rows[0].id;
      assert.ok(session);
      const jobs = await db.query('select * from public.notifications where session_id=$1', [
        session,
      ]);
      assert.equal(jobs.rows.length, 8);
    });
    await t.test(
      'duplicate bookings, skipped weeks and unavailable times are rejected',
      async () => {
        await assert.rejects(() => match(ids.a, ids.c), /already has a session/);
        const outside = new Date(future);
        outside.setUTCHours(17);
        await assert.rejects(
          () => match(ids.b, ids.c, outside.toISOString()),
          /saved availability/,
        );
        await db.query(
          "update public.profiles set skip_weeks=ARRAY[to_char(date_trunc('week',$1::timestamptz at time zone 'UTC'),'YYYY-MM-DD')] where id=$2",
          [startsAt, ids.c],
        );
        await assert.rejects(() => match(ids.c, ids.admin), /skipping this week/);
      },
    );
    await t.test('session membership is enforced; notes are private', async () => {
      assert.equal(
        (await asUser(ids.c, (tx) => tx.query('select * from public.sessions'))).rows.length,
        0,
      );
      assert.equal(
        (await asUser(ids.a, (tx) => tx.query('select * from public.sessions'))).rows.length,
        1,
      );
      await asUser(ids.a, (tx) =>
        tx.query(
          'insert into public.session_notes(session_id,user_id,notes) values($1,$2,\'{"q-1-1":"Private observation"}\')',
          [session, ids.a],
        ),
      );
      assert.equal(
        (await asUser(ids.b, (tx) => tx.query('select * from public.session_notes'))).rows.length,
        0,
      );
      await assert.rejects(
        () =>
          asUser(ids.c, (tx) =>
            tx.query('insert into public.session_notes(session_id,user_id) values($1,$2)', [
              session,
              ids.c,
            ]),
          ),
        /row-level security/,
      );
      await assert.rejects(
        () =>
          asUser(ids.c, (tx) => tx.query("select public.update_session($1,'cancel')", [session])),
        /access denied/,
      );
    });
    await t.test(
      'review submission is participant-only, validates content, and shares with the recipient',
      async () => {
        await assert.rejects(
          () =>
            asUser(ids.a, (tx) =>
              tx.query(
                "select public.submit_review($1,4,'A very clear story.','Add more detail about the result.')",
                [session],
              ),
            ),
          /after the session starts/,
        );
        await db.query("update public.sessions set starts_at=now()-interval '1 hour' where id=$1", [
          session,
        ]);
        await assert.rejects(
          () =>
            asUser(ids.c, (tx) =>
              tx.query(
                "select public.submit_review($1,4,'A very clear story.','Add more detail about the result.')",
                [session],
              ),
            ),
          /Only session participants/,
        );
        await asUser(ids.a, (tx) =>
          tx.query(
            "select public.submit_review($1,4,'A very clear story.','Add more detail about the result.')",
            [session],
          ),
        );
        assert.equal(
          (await asUser(ids.b, (tx) => tx.query('select * from public.reviews'))).rows.length,
          1,
        );
        assert.equal(
          (await asUser(ids.c, (tx) => tx.query('select * from public.reviews'))).rows.length,
          0,
        );
        await asUser(ids.a, (tx) =>
          tx.query(
            "select public.submit_review($1,5,'A very clear story.','Give the result more room next time.')",
            [session],
          ),
        );
        assert.equal((await db.query('select * from public.reviews')).rows.length, 1);
      },
    );
    await t.test(
      'cancellation suppresses pending reminders and creates cancellation notices',
      async () => {
        await db.query("update public.profiles set skip_weeks='{}' where id=$1", [ids.c]);
        const next = (await match(ids.c, ids.admin)).rows[0].id;
        await asUser(ids.c, (tx) => tx.query("select public.update_session($1,'cancel')", [next]));
        const jobs = await db.query<{ kind: string }>(
          'select kind from public.notifications where session_id=$1',
          [next],
        );
        assert.deepEqual(
          jobs.rows.map((j) => j.kind),
          ['cancelled', 'cancelled'],
        );
      },
    );
    await t.test(
      'ordinary members cannot read notification jobs or invoke the worker',
      async () => {
        await assert.rejects(
          () => asUser(ids.a, (tx) => tx.query('select * from public.notifications')),
          /permission denied/,
        );
        await assert.rejects(
          () => asUser(ids.a, (tx) => tx.query('select public.claim_notifications()')),
          /permission denied/,
        );
      },
    );
    await t.test(
      'notification leases prevent duplicate claims and delivery keys survive retries',
      async () => {
        const claim = () =>
          db.transaction(async (tx) => {
            await tx.exec('set local role service_role');
            return tx.query<{ id: string; delivery_key: string }>(
              'select * from public.claim_notifications()',
            );
          });
        const first = await claim();
        assert.ok(first.rows.length > 0);
        assert.ok(first.rows.length <= 5);
        const second = await claim();
        assert.equal(second.rows.length, 0);
        const job = first.rows[0];
        await db.query(
          "update public.notifications set due_at=now()-interval '1 minute',leased_until=null where id=$1",
          [job.id],
        );
        const retry = await claim();
        assert.equal(retry.rows[0].id, job.id);
        assert.equal(retry.rows[0].delivery_key, job.delivery_key);
      },
    );
  } finally {
    await db.close();
  }
});
