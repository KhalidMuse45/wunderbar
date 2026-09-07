'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Mail } from 'lucide-react';
import { requestMagicLink } from '@/app/login/actions';
export default function LoginForm({
  configured,
  failed,
}: {
  configured: boolean;
  failed: boolean;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(
    failed ? 'That link has expired or was already used. Request a fresh one below.' : '',
  );
  useEffect(() => {
    if (cooldown <= 0) return;
    const timeout = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timeout);
  }, [cooldown]);
  return (
    <div className="auth-card">
      <span className="auth-glyph" aria-hidden="true">
        {sent ? '✦' : '✳'}
      </span>
      <h1>{sent ? 'A small step to your inbox.' : 'Your next chapter starts here.'}</h1>
      <p>
        {sent
          ? `We’ve requested a sign-in link for ${email}. Check your inbox and spam folder, then follow the link to your practice space.`
          : 'Sign in with your email. No password to remember, just a little room to grow.'}
      </p>
      {configured ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || cooldown) return;
            setBusy(true);
            setError('');
            try {
              const result = await requestMagicLink(email);
              if (result.error) setError(result.error);
              else {
                setSent(true);
                setCooldown(60);
              }
            } catch {
              setError('Something interrupted sign-in. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy || cooldown > 0}>
            {busy
              ? 'Sending your link…'
              : cooldown
                ? `Send again in ${cooldown}s`
                : sent
                  ? 'Send a fresh link'
                  : 'Send my sign-in link'}
            <Mail size={15} />
          </button>
        </form>
      ) : (
        <div className="intro-note">
          <p>
            Connected accounts are not open on this preview yet. You can try the full practice
            experience in the demo; your changes stay in this browser.
          </p>
        </div>
      )}
      <p className="auth-footnote">
        Your stories are yours. Read about <Link href="/privacy">your data and privacy</Link>.
      </p>
      <div className="auth-demo-link">
        <Link href="/practice?demo=1" className="text-link">
          Explore the demo
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
