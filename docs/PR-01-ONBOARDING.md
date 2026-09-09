# PR 1: Let newly invited members complete onboarding

A new account's first workspace request creates a profile with an empty name and `onboarded=false`. Previously, the browser rejected this valid initial database state before it could open the profile form. The workspace showed an error instead of guiding the member through onboarding.

The workspace read schema now accepts an incomplete name only while onboarding is unfinished. Profile submissions still require a nonblank name, and completed profiles with blank names remain invalid. No database migration or dependency update is required.

## Review scope

- Separate stored-profile validation from profile-submission validation.
- Add domain regressions for new and completed profiles.
- Add desktop/mobile browser coverage for the real invite callback and workspace API, backed by a local Supabase HTTP test fixture.
- Exercise successful onboarding and reload, invalid submissions, failed saves with preserved input, failed initial loads with retry, returning accounts, and expired sessions.
- Run the connected suite in CI with `npm run test:connected`.

The fixture implements only the provider responses these tests require. It does not prove Supabase's live authentication behavior or database authorization; the existing PostgreSQL tests cover database rules, and a configured two-user provider check is still required before a beta launch. No test authentication bypass or fixture route is added to the application.

Availability, session lifecycle, partner refresh, and note recovery remain assigned to later PRs. Existing PostCSS dependency changes are separate from this review unit.

## Manual acceptance

In a configured development project, invite a new test account without creating a named profile manually. Follow the invitation, verify onboarding opens, save a name, and reload. Confirm the workspace loads with that name and does not reopen onboarding. Repeat on a mobile browser. Verify a failed profile save keeps the entered name available for retry.

## Validation completed

- 21 passing domain/PostgreSQL tests.
- 10 passing connected-flow browser tests across desktop and mobile.
- Successful production build, including lint and TypeScript validation.

These checks ran in an isolated local copy of the app. The implementation is ready for review; a remote PR has not been opened, and live Supabase/email verification remains pending.
