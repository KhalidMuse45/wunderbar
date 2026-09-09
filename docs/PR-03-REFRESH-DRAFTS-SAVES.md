# PR 3: Refresh partner changes and preserve notes through failed saves

Previously, a workspace could keep showing a cancelled session or an old meeting link until reloaded. Unsaved interview notes disappeared on refresh. A successful write followed by a failed workspace reload was reported as a failed save, and retrying a bookmark toggle could undo the original change.

## Resulting behavior

- Refresh connected workspaces every 30 seconds while visible, and when focus or connectivity returns. Reads and writes share a queue so an older read cannot overwrite the result of a later write in the same tab.
- Check current session status when opening a peer guide and again before opening a meeting. The guide receives updated session details without replacing its notes. Changed meeting links in the details editor must be loaded before saving another edit.
- Distinguish an unsuccessful or uncertain write from a confirmed write whose follow-up refresh failed. Confirmed changes stay successful; the UI prompts for a refresh. Network failures keep input available and are not automatically replayed.
- Make bookmark save/remove operations explicit and repeatable. Repeating a save never removes the bookmark.
- Save peer and solo note drafts on this device as the user types. Keys include the account and session/question. Drafts recover when reopening the same guide, and can be downloaded or discarded.
- Save a snapshot of peer notes. Text typed while that snapshot is in flight remains a newer local draft. Dirty drafts survive background updates; detected remote changes require confirmation before replacing saved notes.
- Warn before leaving with peer notes not saved to the account, and report unavailable/full browser storage. A failed peer save can be closed while keeping a successfully stored local draft.
- Clear an account's drafts on normal sign-out when browser storage is available. Expired sessions preserve drafts for recovery after signing back into the same account. Workspace reads and mutations check the expected account identity before updating the current UI or writing its data.

## Rollout and limits

No new database migration or dependency is required. Migration `002_availability_outcomes.sql` from PR 2 remains required for connected session outcomes. Reload existing tabs after updating the app; the bookmark API now requires the desired saved state.

Drafts are stored in browser local storage, not encrypted or synced backups. Clearing browser data removes them, and someone with access to browser storage can access local data. The guide reports storage failures and offers **Download notes** for the current draft; the profile's workspace export includes saved workspace data, not unsynced local drafts.

This is periodic refresh, not shared realtime timers or simultaneous editing. Concurrent writes from separate devices still use last-write-wins database behavior; detected conflicts are warned about, but there is no server-side compare-and-swap lock. Other uncertain writes are not automatically retried. Meeting state can still change after the final check while the external call opens.

The connected browser suite uses the real application routes with a local Supabase HTTP fixture. A live-provider check remains required before a real cohort launch. No hosted database, email delivery, deployment, commit, or remote PR was created by this implementation.

## Validation

- 35 domain and database tests passed.
- 36 distinct connected browser checks passed across the regression and focused reliability runs, on desktop and mobile.
- 15 demo browser checks passed; one desktop invocation of a mobile-only check was intentionally skipped.
- Production build passed, including lint and TypeScript validation.

## Manual acceptance

1. Leave a member's session guide open. Update or cancel the session from another account; return to the first window and verify the status updates without losing typed notes.
2. Change a meeting link, then join from an older open guide. Verify it opens the latest link and refuses a cancelled session.
3. Type peer notes, interrupt saving, and reload. Reopen the same guide and verify the draft recovers. Reconnect and save it.
4. Type more while a save is running. Verify the newer text remains locally recoverable and is not incorrectly marked as the saved snapshot.
5. Save a bookmark while losing the response, then retry the same save. Verify it remains bookmarked.
6. Verify saved changes remain successful when the follow-up workspace read fails, and that retrying refresh does not repeat the write.
