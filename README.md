# Wunderbar MVP

Peer behavioral interview practice, using the supplied cream, maroon, and gold design system. This repository contains the complete standalone Wunderbar application.

## Run locally

Use Node.js 22 or later. An `.nvmrc` is included.

```bash
cd ~/Desktop/wunderbar
nvm use
npm ci
npm run dev
```

Open [localhost:3400](http://localhost:3400) for the landing page, or [the practice workspace](http://localhost:3400/practice?demo=1).

With no environment variables, the app runs in an explicitly labeled demo mode. It includes sample sessions, private STAR stories, and sample peer feedback. Your edits persist in this browser. Demo scheduling never pairs you with a real person or sends email.

The demo supports availability selection, profile edits, question search/filter/bookmarks, session scheduling/cancellation, meeting-link entry, calendar downloads, role-specific question guidance, timers, notes, feedback, story editing/deletion, data export, and a local feedback notebook.

## Connect a private beta

The connected-account path is implemented but needs a Supabase project and email settings. No provider accounts, production database, domain, invitations, or deployment have been created by this implementation.

1. Create a dedicated Supabase project. Apply the SQL files in `supabase/migrations/` in numeric order (`001_mvp.sql`, then `002_availability_outcomes.sql`) in a development project first. If `001` is already installed, apply only `002`; do not rerun `001`.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`.
3. Configure Supabase Auth’s site URL and allowed redirect URLs. For local work, allow `http://localhost:3400/auth/confirm`. Use the exact production origin when deploying.
4. Configure a verified SMTP sender in Supabase for reliable auth email delivery. Existing-account magic links are supported; public self-signup is disabled with `shouldCreateUser: false`.
5. Provision your initial users through Supabase’s administrator tools. Send invitations only to people who have agreed to participate. The callback handles PKCE codes and `token_hash` links with `type=email` or `type=invite`. For cross-device magic links, configure the auth email template to use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`; use `type=invite` in the invitation template.
6. After your own auth user exists, assign administrator access in the SQL editor using your actual user UUID:

   ```sql
   insert into private.admins (user_id) values ('YOUR-AUTH-USER-UUID');
   ```

7. Sign in at `/login`. Complete each test member’s profile and availability. The administrator will see **Match members** in the sidebar and can approve two members for an overlapping one-hour window.
8. Test with two consenting accounts before inviting the cohort. The full connected journey still requires live-provider verification: login delivery, callbacks, refresh, cross-account behavior through the deployed API, and email sending.

Members own their profiles and bookmarks. Stories and notes are private even from the application’s matching administrator. Participants can see only their own sessions and submitted peer reviews. Database operators with privileged access remain capable of accessing project data. Administrator status comes from a private database table, never a client-supplied role.

## Reminders

Apply migration `002_availability_outcomes.sql` before running the updated connected app. Existing availability and completed sessions are preserved. The local demo does not need a database migration.

The database queues confirmation, day-before, hour-before, feedback, meeting-link-update and cancellation notifications. Nothing is sent until the worker is configured and invoked.

- Set server-only `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, a verified `EMAIL_FROM`, and a random `CRON_SECRET` of at least 32 characters.
- Configure Supabase Cron or another scheduler to `POST /api/reminders` once per minute with `Authorization: Bearer <CRON_SECRET>`. Store the credential in the scheduler’s secret facility, not in Git.
- A worker claims at most five due notifications, leases them, retries temporary failures, and uses a stable delivery idempotency key. Database delivery records persist beyond the provider’s idempotency window.
- Review `notifications` in the Supabase dashboard for `failed=true`, or expired leases with `attempts >= 5`. Inspect the cause before resetting retries. Indeterminate deliveries should be reconciled with Resend before a manual replay, particularly after its idempotency window expires.
- Cancellation suppresses pending reminders; last-minute bookings skip obsolete reminders. A very narrow race remains possible if cancellation occurs after the worker’s final status check but before the provider accepts the email. This MVP does not claim transactional exactly-once delivery across providers.
- Vercel Hobby’s once-daily cron does not satisfy these reminder timings. Use an appropriate scheduler and review its current plan limits.

No Google Calendar OAuth integration is required. Add an existing Meet or Zoom link and download the `.ics` file. Rescheduling is handled by cancelling a session and approving a new one. Calendar downloads are manual imports; the app does not remotely update previously imported events.

## Check the work

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:connected
npm run build
```

Browser tests use installed Google Chrome on macOS when available. Elsewhere, run `npx playwright install chromium` first. `PW_CHROMIUM_PATH` can select an existing browser binary.

- Domain tests cover DST gaps/repeated hours, calendar timestamps/escaping, link validation, persistence, and feedback ownership.
- Database tests execute the real migration against embedded PostgreSQL (PGlite), with separate anonymous, member, and administrator roles. They check row-level security, matching restrictions, private notes, feedback, cancellation, and notification access.
- Playwright checks desktop/mobile layout and the local demo’s main user journeys.
- Connected-flow browser tests run the real application routes against a local Supabase HTTP fixture on ports 3401 and 3402. They cover invite callbacks, first-time onboarding, strict profile submission validation, persistence after reload, failed loads/saves, returning members, expired sessions, custom availability, explicit outcomes, separate peer feedback, partner refresh, meeting-link rechecks, uncertain responses, and draft recovery. The fixture uses synthetic credentials and is never included in application routes; keep those ports free when running it.
- These tests do not replace a two-user smoke test against a configured Supabase project and real email provider.

Connected workspaces refresh every 30 seconds while visible and when focus or connectivity returns. Opening a peer guide and joining a call perform a fresh check. Background updates preserve notes being edited. A successful write followed by a failed refresh is reported as saved, with a refresh prompt. Bookmark save/remove operations can be retried without toggling the result.

Local draft recovery does not replace saving to your account or exporting important notes. Browser storage can be cleared, denied, or full; failures are shown in the guide. Detected changes to saved notes require confirmation before replacement. Simultaneous writes from multiple devices are still last-write-wins at the database; this MVP does not provide server-side conflict locking. Other uncertain writes are not automatically retried.

The independent GitHub Actions workflow installs Node 22, runs application and database checks, builds the app, and tests the browser flows. It does not deploy.

## MVP boundaries

- Manual match approval, with one-hour availability windows starting at any quarter hour, shared-start suggestions for the next two weeks, skipped-week checks in each member’s timezone, and overlapping-booking checks. The database makes the final booking decision. No automatic matcher or matching reputation score.
- Elapsed bookings appear under **Needs outcome**. After the scheduled hour, a participant records **Completed** or **Did not take place** for both members. Each participant’s feedback is tracked separately and is allowed only for completed sessions. Incorrect recorded outcomes require administrator correction; there is no automated attendance detection or dispute process.
- A library of 40 authored questions with topic-level follow-ups and rubrics. Review the content with the cohort before production publication. Question definitions are bundled with the app; preserve existing IDs/text when adding future versions used by past sessions.
- Manual role coordination and answer timers, not a synchronized video room. Peer notes have explicit save controls and also save when leaving the guide. Peer and solo drafts are saved on this device as you type, scoped to the signed-in account. Confirmed peer saves clear the matching draft; newer text typed during a save is retained. Sign-out clears that account’s local drafts when browser storage is available. Timer state persists on the device; question/role state is not synchronized between participants.
- Peer feedback is intentionally short: a clarity rating, one specific strength, and one concrete next step. A participant can revise their own submitted feedback. No AI scoring or transcription.
- Private, manually authored STAR stories. Solo practice can start a story draft from your notes; review the fields before saving.
- Product suggestions are private to their author and the administrator. There is no public voting board or automated changelog in this MVP. Operators can inspect suggestions in the database dashboard.
- No payments, recording, AI peer, native video, analytics dashboard, or scale infrastructure.
- Connected account deletion is an administrator operation in the initial beta. First cancel outstanding sessions, then remove the auth user using Supabase administration; foreign-key cascades remove associated application records. Deleting a session also removes both participants’ notes/reviews for that session; export affected records and communicate the impact beforehand. Provider email records and backups have their own retention policies.

Before opening the connected beta, finish the operator/contact/retention information on `/privacy`, confirm the question content and product copy, verify provider behavior and operating costs, and approve the production migration/deployment separately.

## Review boundaries

See [the MVP handoff](docs/WUNDERBAR-MVP-HANDOFF.md) for how the implementation maps to the approved plan. Files are local and uncommitted; no remote PRs have been opened or merged.
