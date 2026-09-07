import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="auth-glyph">✦</span>
        <h1>A different path.</h1>
        <p>That page isn’t here. Your practice space is a good place to start.</p>
        <Link className="button button-primary" href="/practice">
          Back to practice ↗
        </Link>
      </div>
    </main>
  );
}
