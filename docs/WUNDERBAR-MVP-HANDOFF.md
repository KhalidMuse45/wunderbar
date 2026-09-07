**Wunderbar MVP implementation handoff**

The user approved building the MVP after reviewing the implementation plan. The application is at the root of the standalone `~/Desktop/wunderbar` repository, with its documentation in `docs/` and CI workflow in `.github/workflows/`.

This is a local implementation, not a claim that the proposed PRs were created, merged, or deployed. The table below provides review boundaries for organizing the eventual PRs.

| Review unit | Planned PR mapping | Implemented scope |
| --- | --- | --- |
| App and design | 01–02 | Independent Next.js app, handoff fonts/tokens, landing page, responsive workspace, forms/dialogs and loading/error/empty states |
| Accounts and inputs | 03–07 | Supabase schema/RLS, invite-based magic-link login, editable profile, recurring availability and current-week skip, 40-question bank and bookmarks |
| Peer session loop | 08–12 | Admin-approved matching, overlap checks, external meeting links, calendar download, cancellation, guided practice, private notes and structured peer review |
| Saved value and iteration | 13–14, reduced scope | Private STAR story bank, export/deletion, session/feedback history, private product suggestions |
| Delivery and verification | 10 and 16, partial | Queued email adapter, protected worker, local Postgres authorization tests, browser tests, separate CI, provider setup instructions |

**Works immediately:** the public landing page and the complete local demo at `/practice?demo=1`. Demo changes persist on the device and are never represented as actual matches, invitations, or peer submissions.

**Implemented but requires configuration and live verification:** real accounts, cross-device data, administrator matching, peer feedback exchange, and email delivery. No Supabase or Resend credentials were provided. Database rules are testable locally; authentication/email/provider behavior requires a configured development project and two approved test users.

**Explicitly deferred from the original plan:** Google Calendar OAuth/Meet creation (15), public feedback voting/changelog, automatic matching, AI/recording/transcription, reputation/streaks, analytics infrastructure, self-serve account deletion, and production provisioning/release. The local MVP is not a completed private-beta launch review under PR-16.

**Run/review:** follow [the README](../README.md). The main application routes are `/`, `/practice`, `/login`, and `/privacy`. Workspace navigation uses URL fragments, with session/story dialogs inside the workspace. The server API is `/api/workspace`; the separately authenticated email worker is `/api/reminders`.

**Suggested eventual PR split:** foundation/design; data/auth; practice features; notifications/tests/docs. This keeps each review focused without requiring sixteen tiny infrastructure PRs for the MVP. Do not include `node_modules`, `.next`, environment secrets, or generated test outputs.

**Validation completed locally:** clean TypeScript and ESLint checks; successful Next.js production build; 19 passing domain/PostgreSQL checks; 15 passing desktop/mobile browser tests, with the mobile-only navigation test intentionally skipped on the desktop project. Desktop and mobile screenshots were visually inspected. The existing ColorStack source and deployment workflow have no changes. Live authentication and email delivery remain unverified until provider configuration is supplied.
