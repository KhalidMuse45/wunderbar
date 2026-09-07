import Link from 'next/link';
import { Brand, Meta } from '@/components/ui';
export const metadata = { title: 'Your Stories Are Yours' };
export default function Privacy() {
  return (
    <main className="privacy-page">
      <Brand />
      <h1>Your stories are yours.</h1>
      <Meta>YOUR DATA IN THIS FIRST VERSION · SEPTEMBER 2026</Meta>
      <h2>When you explore the demo</h2>
      <p>
        The demo uses clearly marked sample people, sessions, stories, and feedback. Your edits are
        stored in this browser’s local storage. They are not sent to a partner or an administrator.
        Clearing browser storage removes them. Use “Export my data” in your profile to keep a copy.
      </p>
      <h2>When you use a connected account</h2>
      <p>
        Your email is used to sign you in and send practice-related messages. Your name, role,
        practice focus, and availability help the administrator arrange sessions. Your matched
        partner can see your name, role, session details, and feedback you submit to them.
      </p>
      <p>
        Your story drafts and interview notes are private to your account. Product feedback is
        visible to you and the administrator. The first version has no public story sharing.
      </p>
      <h2>Your call stays on your call platform</h2>
      <p>
        Wunderbar opens the Meet or Zoom link supplied for a session. It does not record your
        microphone, camera, or call, and it does not generate transcripts or AI feedback. Your
        meeting provider has its own settings and privacy policies.
      </p>
      <h2>Exporting and removing data</h2>
      <p>
        You can export your workspace from your profile and delete individual stories from the story
        editor. Connected-account deletion is handled by the beta administrator; the deployment
        operator must provide their support address before inviting real members. Deleted data may
        remain in provider backups according to the operator’s configured retention policy.
      </p>
      <h2>Before the connected beta opens</h2>
      <p>
        The operator must publish their identity, contact address, configured service providers,
        retention periods, and account-deletion process. This page describes the preview’s actual
        behavior; it is not a complete production privacy notice.
      </p>
      <p>
        <Link href="/practice?demo=1">Back to your practice space ↗</Link>
      </p>
    </main>
  );
}
