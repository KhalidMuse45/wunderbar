'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { questions, competencies, type Question } from '@/content/questions';
import {
  days,
  reduceWorkspace,
  workspaceSchema,
  type Action,
  type Member,
  type Review,
  type Session,
  type Story,
  type Workspace as WorkspaceData,
} from '@/lib/model';
import { calendarFile, dateLabel, download, initials, timeLabel } from '@/lib/date';
import { Brand, Meta, Badge, ArrowLink, Empty, Modal } from './ui';
import {
  AvailabilityDialog,
  IdeaDialog,
  ProfileDialog,
  QuestionDialog,
  ReviewDialog,
  ScheduleDialog,
  SessionDetailsDialog,
  StoryDialog,
} from './forms';
import { PracticeRoom } from './practice-room';
type View = 'overview' | 'sessions' | 'questions' | 'stories' | 'feedback' | 'ideas' | 'admin';
type Dialog =
  | { type: 'profile' | 'availability' | 'schedule' | 'idea' | 'help' }
  | { type: 'story'; story?: Story }
  | { type: 'question'; question: Question }
  | { type: 'practice'; question?: Question; session?: Session }
  | { type: 'review' | 'details'; session: Session }
  | { type: 'received'; review: Review };
const navItems = [
  { id: 'overview', label: 'My practice', icon: LayoutDashboard },
  { id: 'sessions', label: 'My sessions', icon: CalendarDays },
  { id: 'questions', label: 'Question bank', icon: BookOpen },
  { id: 'stories', label: 'My story bank', icon: FileText },
  { id: 'feedback', label: 'Peer feedback', icon: MessageCircle },
] as const;
const viewTitles: Record<View, [string, string, string]> = {
  overview: [
    'YOUR PRACTICE, IN PROGRESS',
    'Good things take practice.',
    'A little more prepared. A little more yourself.',
  ],
  sessions: [
    'ONE CONVERSATION AT A TIME',
    'Show up. Grow together.',
    'Your next good conversation is a small step away.',
  ],
  questions: [
    'THE QUESTION IS JUST THE BEGINNING',
    'Find a story worth telling.',
    'Thoughtful prompts. Better follow-ups. A little less guessing.',
  ],
  stories: [
    'EXPERIENCE, IN YOUR OWN WORDS',
    'Your stories, getting stronger.',
    'You’ve done the hard things. Let’s find the words for them.',
  ],
  feedback: [
    'A FRESH PAIR OF EYES',
    'Small notes. Meaningful growth.',
    'Take what resonates. Try something different next time.',
  ],
  ideas: [
    'WE’RE BUILDING THIS TOGETHER',
    'A little better, with you.',
    'A space for the small things that could make a big difference.',
  ],
  admin: [
    'THE PEOPLE BEHIND THE PRACTICE',
    'Make a thoughtful match.',
    'Review availability, choose a shared time, and bring two people together.',
  ],
};
const STORAGE_KEY = 'wunderbar-workspace-v1';

export default function Workspace({ initial, demo }: { initial: WorkspaceData; demo: boolean }) {
  const [data, setData] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All topics');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sessionTab, setSessionTab] = useState('upcoming');
  const queue = useRef(Promise.resolve());
  const storageWarned = useRef(false);
  const [mobile, setMobile] = useState(false);
  const fetchWorkspace = useCallback(async () => {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.assign('/login');
      throw new Error('Please sign in again.');
    }
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || 'Could not load your workspace. Please try again.');
    const parsed = workspaceSchema.safeParse(result.workspace);
    if (!parsed.success)
      throw new Error('Your workspace could not be read. Please contact the administrator.');
    setData(parsed.data);
    setAdmin(result.admin === true);
    setMembers(result.members ?? []);
    setError('');
    if (!parsed.data.profile.onboarded) setDialog({ type: 'profile' });
  }, []);
  useEffect(() => {
    if (demo) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = workspaceSchema.safeParse(JSON.parse(saved));
          if (parsed.success) setData(parsed.data);
          else setError('The saved demo could not be read. Sample content has been restored.');
        }
      } catch {
        setError('Browser storage is unavailable. Changes will last until this page closes.');
      }
      setLoaded(true);
    } else {
      void fetchWorkspace()
        .then(() => setLoaded(true))
        .catch((reason) => setError(reason.message));
    }
  }, [demo, fetchWorkspace]);
  useEffect(() => {
    if (!demo || !loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      if (!storageWarned.current) {
        storageWarned.current = true;
        setToast('Storage is full or unavailable. Export your data before closing this page.');
      }
    }
  }, [data, demo, loaded]);
  useEffect(() => {
    const sync = () => {
      const id = location.hash.slice(1) as View;
      if (Object.keys(viewTitles).includes(id)) setView(id);
      else setView('overview');
      setMenu(false);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 680px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!menu || !mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    sidebar?.querySelector<HTMLElement>('a')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const items = sidebar?.querySelectorAll<HTMLElement>('a,button');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [menu, mobile]);
  const go = (next: View) => {
    location.hash = next;
    setView(next);
    setSearch('');
    setCategory('All topics');
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const mutate = async (action: Action, message?: string) => {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (demo) setData((current) => reduceWorkspace(current, action));
        else {
          const response = await fetch('/api/workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || 'That change could not be saved. Please try again.');
          await fetchWorkspace();
        }
        if (message) setToast(message);
      });
    queue.current = operation;
    return operation;
  };
  const act = (action: Action, message?: string) => {
    void mutate(action, message).catch((reason) => setToast(reason.message));
  };
  const close = () => setDialog(null);
  const signOut = async () => {
    try {
      const response = await fetch('/api/workspace', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      window.location.assign('/');
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : 'Could not sign out.');
    }
  };
  const completed = data.sessions.filter((s) => s.status === 'completed');
  const upcoming = data.sessions
    .filter((s) => s.status === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const received = data.reviews.filter((review) => review.received);
  const focusQuestions = questions.filter((question) => question.competency === data.profile.focus);
  const title = viewTitles[view];
  const newSession = () =>
    demo || admin ? setDialog({ type: 'schedule' }) : setDialog({ type: 'availability' });
  const openPractice = (session?: Session, question?: Question) =>
    setDialog({ type: 'practice', session, question });
  const calendar = (session: Session) => {
    download(calendarFile(session), `wunderbar-${session.id}.ics`, 'text/calendar;charset=utf-8');
    setToast('Calendar file downloaded. Import it into your calendar.');
  };
  const renderSession = (session: Session) => (
    <article className="session-card" key={session.id}>
      <div className="session-card-head">
        <span className="avatar avatar-large avatar-green">{initials(session.partner)}</span>
        <div className="partner-details">
          <h3>{session.partner}</h3>
          <p>{session.partnerRole}</p>
        </div>
        <Badge tone={session.status === 'upcoming' ? 'green' : ''}>
          {session.sample
            ? 'Sample session'
            : session.status === 'upcoming'
              ? 'Confirmed'
              : session.status === 'completed'
                ? 'Completed'
                : 'Cancelled'}
        </Badge>
      </div>
      <div className="session-schedule">
        <span>
          <CalendarDays size={15} />
          {dateLabel(session.startsAt, data.profile.timezone, true)}
        </span>
        <span>
          <Clock size={15} />
          {timeLabel(session.startsAt, data.profile.timezone)} <span>·</span> 60 minutes
        </span>
        <span>
          <MessageCircle size={15} />
          {session.focus} <span>·</span> Peer behavioral interview
        </span>
      </div>
      <div className="session-bottom">
        {session.status === 'upcoming' ? (
          <button className="button button-primary" onClick={() => openPractice(session)}>
            Open session guide
            <ArrowUpRight size={14} />
          </button>
        ) : (
          <button
            className="text-link"
            onClick={() => {
              const review = received.find((r) => r.sessionId === session.id);
              if (review) setDialog({ type: 'received', review });
              else if (session.status === 'completed') setDialog({ type: 'review', session });
              else setDialog({ type: 'details', session });
            }}
          >
            {session.status === 'cancelled'
              ? 'Session details'
              : received.some((r) => r.sessionId === session.id)
                ? 'Read peer feedback'
                : 'Leave feedback'}
            <ArrowUpRight size={14} />
          </button>
        )}
        <div style={{ display: 'flex', gap: 7 }}>
          <button
            className="icon-button"
            aria-label={`Details for session with ${session.partner}`}
            onClick={() => setDialog({ type: 'details', session })}
          >
            <Settings2 size={15} />
          </button>
          {session.status === 'upcoming' && (
            <button
              className="icon-button"
              aria-label={`Download calendar for ${session.partner}`}
              onClick={() => calendar(session)}
            >
              <CalendarDays size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div className="workspace">
      <a href="#practice-main" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`sidebar ${menu ? 'sidebar-open' : ''}`}
        aria-label="Practice navigation"
        inert={mobile && !menu}
      >
        <Brand />
        <Meta className="sidebar-caption">A LITTLE BETTER, TOGETHER.</Meta>
        <Meta className="nav-label">YOUR WORKSPACE</Meta>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <a
              href={`#${item.id}`}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              key={item.id}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => go(item.id)}
            >
              <item.icon size={17} />
              {item.label}
              {item.id === 'sessions' && upcoming.length > 0 && (
                <span className="nav-count">{upcoming.length.toString().padStart(2, '0')}</span>
              )}
              {item.id === 'stories' && (
                <span className="nav-count">{data.stories.length.toString().padStart(2, '0')}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="nav-separator" />
        <nav className="sidebar-nav" aria-label="Community">
          <a
            href="#ideas"
            onClick={() => go('ideas')}
            className={`nav-item ${view === 'ideas' ? 'active' : ''}`}
            aria-current={view === 'ideas' ? 'page' : undefined}
          >
            <Sparkles size={17} />
            Help shape Wunderbar
          </a>
          {admin && (
            <a
              href="#admin"
              className={`nav-item ${view === 'admin' ? 'active' : ''}`}
              onClick={() => go('admin')}
            >
              <ShieldCheck size={17} />
              Match members
            </a>
          )}
          <button
            className="nav-item"
            onClick={() => {
              setMenu(false);
              setDialog({ type: 'help' });
            }}
          >
            <HelpCircle size={17} />A little guidance
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-glyph" aria-hidden="true">
              ✳
            </span>
            <h3>Progress loves company.</h3>
            <p>You don’t have to have it all figured out. Just keep showing up.</p>
            <ArrowLink
              onClick={() => {
                setMenu(false);
                setDialog({ type: 'availability' });
              }}
            >
              Make time for yourself
            </ArrowLink>
          </div>
          <button
            className="sidebar-profile"
            onClick={() => {
              setMenu(false);
              setDialog({ type: 'profile' });
            }}
          >
            <span className="avatar avatar-small avatar-gold">{initials(data.profile.name)}</span>
            <span>
              <strong>{data.profile.name || 'Your profile'}</strong>
              <small>{demo ? 'Your demo workspace' : data.profile.role}</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="workspace-body" inert={mobile && menu}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Your workspace</span>
            <ChevronRight size={12} />
            <strong>
              {navItems.find((item) => item.id === view)?.label ??
                (view === 'admin' ? 'Match members' : 'Help shape Wunderbar')}
            </strong>
          </div>
          <div className="topbar-actions">
            <Badge tone={demo ? 'outline' : 'green'}>
              {demo ? 'Interactive demo' : 'Private beta'}
            </Badge>
            <button className="text-link" onClick={() => setDialog({ type: 'help' })}>
              <HelpCircle size={14} />
              How it works
            </button>
            <button
              className="avatar avatar-small avatar-gold"
              aria-label="Edit your profile"
              onClick={() => setDialog({ type: 'profile' })}
            >
              {initials(data.profile.name)}
            </button>
          </div>
        </header>
        <main className="workspace-main" id="practice-main" tabIndex={-1}>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              {!demo && (
                <button
                  className="text-link"
                  style={{ marginLeft: 10 }}
                  onClick={() =>
                    void fetchWorkspace()
                      .then(() => setLoaded(true))
                      .catch((reason) => setError(reason.message))
                  }
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {!loaded && !demo ? (
            <div className="loading">
              <span aria-hidden="true">✳</span>
              <p>Making a little room for you…</p>
            </div>
          ) : (
            <div className="view-content" key={view}>
              <div className="page-intro">
                <div>
                  <Meta>{title[0]}</Meta>
                  <h1>{title[1]}</h1>
                  <p>{title[2]}</p>
                </div>
                {view === 'overview' && (
                  <button
                    className="button button-secondary"
                    onClick={() => setDialog({ type: 'availability' })}
                  >
                    <CalendarDays size={14} />
                    My availability
                  </button>
                )}
                {view === 'sessions' && (
                  <button className="button button-primary" onClick={newSession}>
                    <Plus size={15} />
                    {demo || admin ? 'Plan a session' : 'Set availability'}
                  </button>
                )}
                {view === 'stories' && (
                  <button
                    className="button button-primary"
                    onClick={() => setDialog({ type: 'story' })}
                  >
                    <Plus size={15} />
                    Add a story
                  </button>
                )}
                {view === 'ideas' && (
                  <button
                    className="button button-primary"
                    onClick={() => setDialog({ type: 'idea' })}
                  >
                    <Plus size={15} />
                    Share an idea
                  </button>
                )}
                {view === 'admin' && admin && (
                  <button className="button button-primary" onClick={newSession}>
                    <Users size={15} />
                    Create a match
                  </button>
                )}
              </div>
              {view === 'overview' && (
                <>
                  <div className="overview-top">
                    <section className="welcome-card">
                      <Meta>SMALL STEPS. BIG POSSIBILITIES.</Meta>
                      <h2>
                        Your next chapter
                        <br />
                        starts with a<br />
                        conversation.
                      </h2>
                      <p>You bring the experience. We’ll bring the practice.</p>
                      <button
                        className="button button-cream"
                        onClick={() => openPractice(undefined, focusQuestions[0])}
                      >
                        Make a little progress
                        <ArrowUpRight size={14} />
                      </button>
                      <div className="welcome-art" aria-hidden="true">
                        <span className="welcome-art-star">✳</span>
                        <div className="welcome-ticket">
                          <Meta>A NOTE TO YOURSELF</Meta>
                          <strong>
                            You’ve
                            <br />
                            got this.
                          </strong>
                          <span>one conversation at a time.</span>
                          <span className="ticket-corner">✦</span>
                        </div>
                      </div>
                    </section>
                    <section className="habit-card">
                      <div className="row-between">
                        <Meta>YOUR WEEKLY RHYTHM</Meta>
                        <span style={{ color: 'var(--maroon)', fontSize: 23 }}>✦</span>
                      </div>
                      <h3>
                        Make showing up
                        <br />
                        your superpower.
                      </h3>
                      <p>
                        A small commitment to the person
                        <br />
                        you’re becoming.
                      </p>
                      <div className="habit-days">
                        {days.map((day) => (
                          <div
                            className={`habit-day ${data.profile.availability.some((slot) => slot.startsWith(day)) ? 'available' : ''}`}
                            key={day}
                          >
                            {day[0]}
                            <span>
                              {data.profile.availability.some((slot) => slot.startsWith(day)) ? (
                                <Check size={11} />
                              ) : (
                                '·'
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      <ArrowLink onClick={() => setDialog({ type: 'availability' })}>
                        {data.profile.availability.length
                          ? 'Your availability is set'
                          : 'Find your weekly rhythm'}
                      </ArrowLink>
                    </section>
                  </div>
                  <div className="stats-row">
                    <div className="stat">
                      <div className="stat-number">
                        {completed.length.toString().padStart(2, '0')}
                      </div>
                      <div className="stat-label">
                        Conversations practiced<small>Every one is a step forward.</small>
                      </div>
                      <MessageCircle size={22} />
                    </div>
                    <div className="stat">
                      <div className="stat-number">
                        {data.stories.length.toString().padStart(2, '0')}
                      </div>
                      <div className="stat-label">
                        Stories in your corner<small>Experience worth remembering.</small>
                      </div>
                      <BookOpen size={22} />
                    </div>
                    <div className="stat">
                      <div className="stat-number">
                        {new Set(completed.map((s) => s.focus)).size.toString().padStart(2, '0')}
                      </div>
                      <div className="stat-label">
                        Focus areas explored<small>Room to keep growing.</small>
                      </div>
                      <Sparkles size={22} />
                    </div>
                  </div>
                  <div className="overview-middle">
                    <section>
                      <div className="section-meta">
                        <Meta>№ 01 — YOUR NEXT CONVERSATION</Meta>
                        <ArrowLink onClick={() => go('sessions')}>All sessions</ArrowLink>
                      </div>
                      {upcoming[0] ? (
                        renderSession(upcoming[0])
                      ) : (
                        <Empty
                          title="Someone’s in your corner."
                          action={
                            <button className="button button-primary" onClick={newSession}>
                              {demo ? 'Plan your first session' : 'Set your availability'}
                              <ArrowUpRight size={15} />
                            </button>
                          }
                        >
                          Choose a little time for practice. Your next match will appear here once
                          it’s approved.
                        </Empty>
                      )}
                    </section>
                    <section>
                      <div className="section-meta">
                        <Meta>№ 02 — A LITTLE FOCUS</Meta>
                        <span aria-hidden="true" style={{ fontSize: 13 }}>
                          ↗
                        </span>
                      </div>
                      <div className="focus-card">
                        <span className="focus-glyph" aria-hidden="true">
                          ✳
                        </span>
                        <Meta>IN YOUR CORNER THIS WEEK</Meta>
                        <h3>
                          {data.profile.focus === 'Teamwork' ? (
                            <>
                              Great things
                              <br />
                              happen together.
                            </>
                          ) : (
                            <>
                              Let’s talk about
                              <br />
                              {data.profile.focus.toLowerCase()}.
                            </>
                          )}
                        </h3>
                        <p>
                          {data.profile.focus === 'Teamwork'
                            ? 'The different perspectives. The shared wins. The moments that made you a better teammate.'
                            : 'There’s a story in your experience. A thoughtful question can help you find it.'}
                        </p>
                        <ArrowLink
                          onClick={() => {
                            go('questions');
                            setCategory(data.profile.focus);
                          }}
                        >
                          Explore {data.profile.focus.toLowerCase()} questions
                        </ArrowLink>
                      </div>
                    </section>
                  </div>
                  <section className="recent-section">
                    <div className="section-meta">
                      <Meta>№ 03 — SMALL SIGNS OF PROGRESS</Meta>
                      <ArrowLink onClick={() => go('feedback')}>See your feedback</ArrowLink>
                    </div>
                    <div className="recent-list">
                      {received.slice(0, 2).map((review) => (
                        <button
                          key={review.id}
                          className="recent-row"
                          onClick={() => setDialog({ type: 'received', review })}
                        >
                          <span className="recent-icon">
                            <MessageCircle size={16} />
                          </span>
                          <div className="recent-copy">
                            <span className="recent-title">
                              A fresh perspective from {review.author.split(' ')[0]}
                            </span>
                            <p>
                              Thoughtful feedback on your last conversation
                              {review.sample ? ' · Sample' : ''}
                            </p>
                          </div>
                          <Badge tone="green">Ready to read</Badge>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                      {data.stories.slice(0, 1).map((story) => (
                        <button
                          key={story.id}
                          className="recent-row"
                          onClick={() => setDialog({ type: 'story', story })}
                        >
                          <span className="recent-icon">
                            <FileText size={16} />
                          </span>
                          <div className="recent-copy">
                            <span className="recent-title">{story.title}</span>
                            <p>
                              A story in your corner · {story.competency}
                              {story.sample ? ' · Sample' : ''}
                            </p>
                          </div>
                          <span className="recent-date">
                            {dateLabel(story.date, data.profile.timezone)}
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                      {!received.length && !data.stories.length && (
                        <Empty glyph="✦" title="Your progress starts with one step.">
                          Save your first story or complete a practice session. We’ll keep the
                          useful moments here.
                        </Empty>
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === 'sessions' && (
                <>
                  <div className="filter-tabs" aria-label="Filter sessions">
                    {['upcoming', 'completed', 'cancelled'].map((tab) => (
                      <button
                        key={tab}
                        className={`filter-button ${sessionTab === tab ? 'active' : ''}`}
                        onClick={() => setSessionTab(tab)}
                        aria-pressed={sessionTab === tab}
                      >
                        {tab[0].toUpperCase() + tab.slice(1)} ·{' '}
                        {data.sessions.filter((s) => s.status === tab).length}
                      </button>
                    ))}
                  </div>
                  {data.sessions.some((s) => s.status === sessionTab) ? (
                    <div className="sessions-grid">
                      {data.sessions
                        .filter((s) => s.status === sessionTab)
                        .sort((a, b) =>
                          sessionTab === 'upcoming'
                            ? a.startsAt.localeCompare(b.startsAt)
                            : b.startsAt.localeCompare(a.startsAt),
                        )
                        .map(renderSession)}
                    </div>
                  ) : (
                    <Empty
                      title={
                        sessionTab === 'upcoming'
                          ? 'Make room for a good conversation.'
                          : 'Your story is still unfolding.'
                      }
                      action={
                        sessionTab === 'upcoming' ? (
                          <button className="button button-primary" onClick={newSession}>
                            Take the next step
                            <ArrowUpRight size={15} />
                          </button>
                        ) : undefined
                      }
                    >
                      {sessionTab === 'upcoming'
                        ? 'Set your availability and your next approved match will appear here.'
                        : 'Sessions will appear here as you work through your practice journey.'}
                    </Empty>
                  )}
                </>
              )}
              {view === 'questions' && (
                <>
                  <div className="toolbar">
                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Search questions"
                        placeholder="Find a question, a topic, a place to start…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <button
                      className={`filter-button ${savedOnly ? 'active' : ''}`}
                      onClick={() => setSavedOnly(!savedOnly)}
                      aria-pressed={savedOnly}
                    >
                      <Bookmark size={13} /> Saved ({data.savedQuestions.length})
                    </button>
                  </div>
                  <div className="filter-tabs" aria-label="Filter by topic">
                    {['All topics', ...competencies].map((topic) => (
                      <button
                        className={`filter-button ${category === topic ? 'active' : ''}`}
                        key={topic}
                        onClick={() => setCategory(topic)}
                        aria-pressed={category === topic}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const filtered = questions.filter(
                      (q) =>
                        (category === 'All topics' || q.competency === category) &&
                        (!savedOnly || data.savedQuestions.includes(q.id)) &&
                        `${q.prompt} ${q.competency}`.toLowerCase().includes(search.toLowerCase()),
                    );
                    return (
                      <>
                        <Meta className="results-meta">
                          {filtered.length} THOUGHTFUL QUESTION{filtered.length !== 1 ? 'S' : ''} ·
                          FOLLOW-UPS & GUIDANCE INCLUDED
                        </Meta>
                        <div className="question-list">
                          {filtered.map((q, index) => (
                            <article className="question-row" key={q.id}>
                              <span className="question-number">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <button
                                className="question-open"
                                onClick={() => setDialog({ type: 'question', question: q })}
                              >
                                <h3>{q.prompt}</h3>
                                <div className="question-tags">
                                  <Badge tone="rose">{q.competency}</Badge>
                                  <Meta>
                                    {q.difficulty} <span>·</span> 4 MIN
                                  </Meta>
                                </div>
                              </button>
                              <button
                                className={`icon-button ${data.savedQuestions.includes(q.id) ? 'saved-icon' : ''}`}
                                aria-label={`${data.savedQuestions.includes(q.id) ? 'Unsave' : 'Save'} question: ${q.prompt}`}
                                aria-pressed={data.savedQuestions.includes(q.id)}
                                onClick={() => act({ type: 'bookmark', id: q.id })}
                              >
                                <Bookmark
                                  size={17}
                                  fill={
                                    data.savedQuestions.includes(q.id) ? 'currentColor' : 'none'
                                  }
                                />
                              </button>
                            </article>
                          ))}
                        </div>
                        {!filtered.length && (
                          <Empty title="Try a different starting point.">
                            No questions match these filters. Try another topic or a shorter search.
                          </Empty>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              {view === 'stories' && (
                <>
                  <div className="intro-note">
                    <LockKeyhole size={17} />
                    <p>
                      Your stories are just for you. Use Situation, Task, Action, and Result to turn
                      an experience into an answer that feels like you.
                    </p>
                  </div>
                  <div className="toolbar">
                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Search stories"
                        placeholder="Find a story in your experience…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filter stories by topic"
                      style={{ width: 'auto' }}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {['All topics', ...competencies].map((topic) => (
                        <option key={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const stories = data.stories.filter(
                      (story) =>
                        (category === 'All topics' || story.competency === category) &&
                        `${story.title} ${story.situation} ${story.action} ${story.result}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    );
                    return stories.length ? (
                      <div className="cards-grid">
                        {stories.map((story) => (
                          <article className="story-card" key={story.id}>
                            <div className="row-between">
                              <Badge tone="rose">{story.competency}</Badge>
                              <Meta>
                                <LockKeyhole size={10} />
                                PRIVATE{story.sample ? ' · SAMPLE' : ''}
                              </Meta>
                            </div>
                            <h3>{story.title}</h3>
                            <p>
                              {story.situation.slice(0, 150) ||
                                'A story waiting for a little detail.'}
                              {story.situation.length > 150 ? '…' : ''}
                            </p>
                            <div className="row-between">
                              <div className="star-mini" aria-label="STAR completion">
                                {(['situation', 'task', 'action', 'result'] as const).map(
                                  (field, index) => (
                                    <span
                                      className={story[field].trim() ? 'filled' : ''}
                                      key={field}
                                      title={`${field}: ${story[field].trim() ? 'written' : 'empty'}`}
                                    >
                                      {'STAR'[index]}
                                    </span>
                                  ),
                                )}
                              </div>
                              <ArrowLink onClick={() => setDialog({ type: 'story', story })}>
                                Keep shaping it
                              </ArrowLink>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title={
                          search || category !== 'All topics'
                            ? 'No stories found here yet.'
                            : 'Your experience belongs here.'
                        }
                        action={
                          <button
                            className="button button-primary"
                            onClick={() => setDialog({ type: 'story' })}
                          >
                            <Plus size={15} />
                            Add your first story
                          </button>
                        }
                      >
                        A project, a challenge, a small win. Start with one moment worth
                        remembering.
                      </Empty>
                    );
                  })()}
                </>
              )}
              {view === 'feedback' && (
                <>
                  <div className="intro-note">
                    <MessageCircle size={17} />
                    <p>
                      Feedback is a perspective to learn from. Your private story bank is a good
                      place to try the next version of your answer.
                    </p>
                  </div>
                  {received.length ? (
                    received.map((review) => (
                      <article className="review-block" key={review.id}>
                        <div className="row-between">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="avatar avatar-small">{initials(review.author)}</span>
                            <h3>{review.author}</h3>
                          </div>
                          <Badge tone="green">
                            {review.sample ? 'Sample feedback' : 'Peer feedback'}
                          </Badge>
                        </div>
                        <div className="review-copy">
                          <div>
                            <Meta>WHAT LANDED</Meta>
                            <p>{review.strength}</p>
                          </div>
                          <div>
                            <Meta>ONE THING TO TRY</Meta>
                            <p>{review.improvement}</p>
                          </div>
                        </div>
                        <div
                          className="row-between"
                          style={{
                            borderTop: '1px solid var(--line)',
                            paddingTop: 16,
                            marginTop: 20,
                          }}
                        >
                          <span className="stars" aria-label={`Clarity: ${review.score} out of 5`}>
                            {'★'.repeat(review.score)}
                            {'☆'.repeat(5 - review.score)}
                          </span>
                          <ArrowLink onClick={() => go('stories')}>Work on a story</ArrowLink>
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty title="A fresh perspective is on its way.">
                      Feedback from your practice partner will appear here after they submit it.
                    </Empty>
                  )}
                  {data.reviews.some((r) => !r.received) && (
                    <>
                      <Meta>FEEDBACK YOU’VE GIVEN</Meta>
                      {data.reviews
                        .filter((r) => !r.received)
                        .map((r) => (
                          <div className="idea-card" key={r.id}>
                            <h3>
                              Your note to{' '}
                              {data.sessions.find((s) => s.id === r.sessionId)?.partner}
                            </h3>
                            <p>{r.improvement}</p>
                            <Badge>
                              {demo ? 'Saved on this device' : 'Shared with your partner'}
                            </Badge>
                          </div>
                        ))}
                    </>
                  )}
                </>
              )}
              {view === 'ideas' && (
                <>
                  <div className="intro-note">
                    <Sparkles size={17} />
                    <p>
                      {demo
                        ? 'This is your demo feedback notebook. Notes stay in your browser and are not sent to anyone.'
                        : 'Your suggestions are shared privately with the administrator. Tell us what would make your next practice more useful.'}
                    </p>
                  </div>
                  {data.ideas.length ? (
                    data.ideas.map((idea) => (
                      <article className="idea-card" key={idea.id}>
                        <div className="row-between">
                          <h3>{idea.title}</h3>
                          <Badge tone="rose">{demo ? 'Local note' : idea.status}</Badge>
                        </div>
                        <p>{idea.body}</p>
                        <Meta>{dateLabel(idea.date, data.profile.timezone)}</Meta>
                      </article>
                    ))
                  ) : (
                    <Empty
                      glyph="✦"
                      title="Good ideas start small."
                      action={
                        <button
                          className="button button-primary"
                          onClick={() => setDialog({ type: 'idea' })}
                        >
                          Share a thought
                          <ArrowUpRight size={15} />
                        </button>
                      }
                    >
                      Something felt clunky? A question really helped? We’d love to make more room
                      for what matters.
                    </Empty>
                  )}
                </>
              )}
              {view === 'admin' &&
                (admin ? (
                  <>
                    <div className="intro-note">
                      <ShieldCheck size={17} />
                      <p>
                        Only completed profiles appear here. Select a one-hour slot shared by both
                        members; the database checks availability and overlapping commitments before
                        confirming.
                      </p>
                    </div>
                    <div className="admin-members">
                      {members.map((member) => (
                        <div className="member-row" key={member.id}>
                          <div className="row-between">
                            <strong>{member.name}</strong>
                            <Badge tone="rose">{member.focus}</Badge>
                          </div>
                          <p>
                            {member.role} · {member.timezone}
                          </p>
                          <p>
                            {member.availability.length
                              ? member.availability.join(' · ')
                              : 'No availability selected'}
                            {member.skipWeeks.length
                              ? ` · Skipping weeks: ${member.skipWeeks.join(', ')}`
                              : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                    {!members.length && (
                      <Empty title="Your cohort starts here.">
                        Members will appear after they finish their profile and add availability.
                      </Empty>
                    )}
                  </>
                ) : (
                  <Empty title="This space is for the administrator.">
                    Your practice sessions and stories are available from the navigation.
                  </Empty>
                ))}
            </div>
          )}
          <footer className="workspace-footer">
            <p>Good things take practice. Great things take people.</p>
            {demo ? (
              <span className="demo-notice">
                Sample workspace · Saved on this device{' '}
                <Link href="/login">
                  Join the beta <ArrowUpRight size={11} />
                </Link>
              </span>
            ) : (
              <Link className="meta" href="/privacy">
                YOUR STORIES ARE YOURS <LockKeyhole size={10} />
              </Link>
            )}
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      {dialog?.type === 'profile' && (
        <ProfileDialog
          data={data}
          demo={demo}
          mutate={mutate}
          close={close}
          signOut={() => void signOut()}
        />
      )}
      {dialog?.type === 'availability' && (
        <AvailabilityDialog profile={data.profile} mutate={mutate} close={close} />
      )}
      {dialog?.type === 'schedule' && (
        <ScheduleDialog
          profile={data.profile}
          demo={demo}
          members={members}
          mutate={mutate}
          close={close}
        />
      )}
      {dialog?.type === 'story' && (
        <StoryDialog
          story={dialog.story}
          focus={data.profile.focus}
          mutate={mutate}
          close={close}
        />
      )}
      {dialog?.type === 'idea' && <IdeaDialog demo={demo} mutate={mutate} close={close} />}
      {dialog?.type === 'details' && (
        <SessionDetailsDialog session={dialog.session} mutate={mutate} close={close} />
      )}
      {dialog?.type === 'review' && (
        <ReviewDialog
          session={dialog.session}
          author={data.profile.name}
          demo={demo}
          mutate={mutate}
          close={close}
        />
      )}
      {dialog?.type === 'question' && (
        <QuestionDialog
          question={dialog.question}
          saved={data.savedQuestions.includes(dialog.question.id)}
          toggle={() => act({ type: 'bookmark', id: dialog.question.id })}
          practice={() => openPractice(undefined, dialog.question)}
          close={close}
        />
      )}
      {dialog?.type === 'practice' && (
        <PracticeRoom
          session={dialog.session}
          question={dialog.question}
          demo={demo}
          mutate={mutate}
          close={close}
          finish={(session) => setDialog({ type: 'review', session })}
          saveStory={(story) => setDialog({ type: 'story', story })}
        />
      )}
      {dialog?.type === 'received' && (
        <Modal
          title={`A note from ${dialog.review.author.split(' ')[0]}.`}
          eyebrow={dialog.review.sample ? 'SAMPLE PEER FEEDBACK' : 'A FRESH PERSPECTIVE'}
          onClose={close}
        >
          <div className="review-copy">
            <div>
              <Meta>WHAT LANDED</Meta>
              <p>{dialog.review.strength}</p>
            </div>
            <div>
              <Meta>ONE THING TO TRY NEXT TIME</Meta>
              <p>{dialog.review.improvement}</p>
            </div>
          </div>
          <div className="form-actions">
            <button
              className="button button-primary"
              onClick={() => {
                close();
                go('stories');
              }}
            >
              Give a story another look
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === 'help' && (
        <Modal
          title="A conversation. A little growth."
          eyebrow="YOUR PRACTICE, MADE SIMPLE"
          onClose={close}
        >
          <div className="help-steps">
            {[
              [
                '01',
                'Find your weekly rhythm.',
                'Set your availability and practice focus. An administrator reviews the cohort and confirms your peer match.',
              ],
              [
                '02',
                'Meet a real person.',
                'Use your shared Meet or Zoom link. Spend five minutes getting to know each other, then take turns: 20 minutes interviewing and five minutes of feedback each.',
              ],
              [
                '03',
                'Let the questions guide you.',
                'Keep Wunderbar open beside your call. Interviewers see follow-ups and a rubric; interviewees can use the STAR checklist and timer. Switch questions and roles together.',
              ],
              [
                '04',
                'Leave with something useful.',
                'Wrap up with one specific strength and one concrete change. Save your stories and bring a little more confidence to the next conversation.',
              ],
            ].map(([n, title, copy]) => (
              <div className="help-step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="form-note">
            Calls are not recorded. There is no AI interviewer or automated scoring in this version.
            If a partner can’t make it, try a self-guided question and ask the administrator to
            arrange another session.
          </p>
          <div className="form-actions">
            <button className="button button-primary" onClick={close}>
              Sounds like a good start
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
