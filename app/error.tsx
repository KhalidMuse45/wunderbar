'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="auth-glyph">✳</span>
        <h1>A small pause.</h1>
        <p>
          Something interrupted this page. Try again, or return to the demo while we find our
          footing.
        </p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link className="button button-secondary" href="/practice?demo=1">
          Open the demo
        </Link>
      </div>
    </main>
  );
}
