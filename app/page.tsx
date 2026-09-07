import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Check, Clock, Users } from 'lucide-react';
import { Brand, Meta } from '@/components/ui';
export default function Landing() {
  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link href="/practice?demo=1">
            Take a look inside <ArrowUpRight size={15} />
          </Link>
        </nav>
        <Link className="button button-primary" href="/login">
          Find your confidence <ArrowUpRight size={16} />
        </Link>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <Meta>
              <span className="tiny-star">✳</span> THE HUMAN SIDE OF INTERVIEW PREP
            </Meta>
            <h1>
              Good things
              <br />
              take <span className="word-highlight">practice.</span>
            </h1>
            <p className="landing-lede">Especially being yourself in an interview.</p>
            <p className="landing-description">
              Find your words with someone who gets it. Peer mock interviews, thoughtful feedback,
              and a little more confidence every week.
            </p>
            <div className="landing-actions">
              <Link href="/login" className="button button-primary button-large">
                Let’s practice together <ArrowUpRight size={18} />
              </Link>
              <Link href="/practice?demo=1" className="text-link">
                Explore the demo <ArrowRight size={17} />
              </Link>
            </div>
            <Meta className="hero-footnote">
              <Check size={13} /> REAL PEOPLE <span>·</span> BETTER STORIES <span>·</span> YOUR OWN
              PACE
            </Meta>
          </div>
          <div className="landing-art" aria-label="A preview of a peer practice session">
            <div className="art-caption meta">A SMALL STEP. A SHARED EXPERIENCE.</div>
            <div className="art-star" aria-hidden="true">
              ✳
            </div>
            <div className="conversation-card conversation-back">
              <Meta>01 / FIND YOUR PEOPLE</Meta>
              <div className="avatar-pair">
                <span className="avatar avatar-rose">YOU</span>
                <span className="avatar avatar-gold">PEER</span>
              </div>
              <p>
                In your corner.
                <br />
                <em>On the same journey.</em>
              </p>
            </div>
            <div className="conversation-card conversation-front">
              <div className="row-between">
                <Meta>YOUR NEXT CONVERSATION</Meta>
                <span className="small-glyph">✦</span>
              </div>
              <h3>
                Less pressure.
                <br />
                More possibility.
              </h3>
              <div className="art-card-tags">
                <span>
                  <Users size={14} /> One thoughtful peer
                </span>
                <span>
                  <Clock size={14} /> One hour for you
                </span>
              </div>
              <div className="art-question">
                “Tell me about a time
                <br />
                you surprised yourself.”
              </div>
              <Link href="/practice?demo=1" className="art-card-link">
                See what practice feels like <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="art-note">
              you don’t have to
              <br />
              <span>figure it out alone.</span>
              <span className="note-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </div>
        </section>
        <div className="landing-divider">
          <Meta>A LITTLE PRACTICE. A LOT MORE POSSIBILITY.</Meta>
          <span aria-hidden="true">✦</span>
          <Meta>BUILT AROUND PEOPLE, JUST LIKE YOU.</Meta>
        </div>
        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <div>
              <Meta>№ 01 — A GOOD KIND OF ROUTINE</Meta>
              <h2>
                Your next chapter starts
                <br />
                with a conversation.
              </h2>
            </div>
            <p>
              You bring your experience.
              <br />
              We give you a place to practice telling it.
            </p>
          </div>
          <div className="how-grid">
            {[
              [
                '01',
                'Make a little room.',
                'Tell us what you’re working toward and when you’re free. We’ll review your availability and pair you with a peer.',
              ],
              [
                '02',
                'Show up as you are.',
                'Take turns interviewing over Meet or Zoom. Thoughtful prompts and follow-ups help you both find the right words.',
              ],
              [
                '03',
                'Take something with you.',
                'Leave with specific feedback and one thing to try next time. Save your stories and watch your confidence grow.',
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span className="step-number">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-close">
          <span className="close-star" aria-hidden="true">
            ✳
          </span>
          <Meta>YOU HAVE THE EXPERIENCE. LET’S FIND THE WORDS.</Meta>
          <h2>
            A little less “um.”
            <br />
            <em>A little more you.</em>
          </h2>
          <Link href="/practice?demo=1" className="button button-gold button-large">
            Step inside Wunderbar <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand small />
        <p>Good things take practice. Great things take people.</p>
        <Link href="/privacy">
          Privacy & your data <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
