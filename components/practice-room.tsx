'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Pause, Play, RotateCcw, Check } from 'lucide-react';
import { questions, rubric, type Question } from '@/content/questions';
import type { Session, Story } from '@/lib/model';
import { Modal, Meta, Badge } from './ui';
import type { Mutate } from './forms';
type ClockState = {
  elapsed: number;
  started: number;
  running: boolean;
  index: number;
  role: 'answering' | 'interviewing';
};
export function PracticeRoom({
  session,
  question,
  mutate,
  close,
  finish,
  saveStory,
  demo,
}: {
  session?: Session;
  question?: Question;
  mutate: Mutate;
  close: () => void;
  finish: (session: Session) => void;
  saveStory: (story: Story) => void;
  demo: boolean;
}) {
  const questionSet = question
    ? [question]
    : (session?.questionIds
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is Question => !!q) ?? []);
  const set = questionSet.length ? questionSet : questions.slice(0, 3);
  const key = `wunderbar-timer-${session?.id ?? question?.id ?? 'solo'}`;
  const [clock, setClock] = useState<ClockState>({
    elapsed: 0,
    started: 0,
    running: false,
    index: 0,
    role: 'answering',
  });
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(session?.notes ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const lastSaved = useRef(JSON.stringify(session?.notes ?? {}));
  const current = set[Math.min(clock.index, set.length - 1)];
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (
          Number.isFinite(value.elapsed) &&
          value.elapsed >= 0 &&
          Number.isFinite(value.started) &&
          typeof value.running === 'boolean' &&
          Number.isInteger(value.index) &&
          value.index >= 0 &&
          value.index < set.length &&
          ['answering', 'interviewing'].includes(value.role)
        )
          setClock(value);
      }
    } catch {
      /* An unavailable timer cache never blocks practice. */
    }
    setReady(true);
  }, [key, set.length]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(clock));
    } catch {
      /* Timer still runs in memory. */
    }
  }, [clock, key, ready]);
  useEffect(() => {
    if (!clock.running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [clock.running]);
  const elapsed = Math.max(0, clock.elapsed + (clock.running ? now - clock.started : 0));
  const seconds = Math.floor(elapsed / 1000);
  const toggleTimer = () => {
    const time = Date.now();
    setNow(time);
    setClock((old) =>
      old.running
        ? { ...old, elapsed: old.elapsed + time - old.started, running: false }
        : { ...old, started: time, running: true },
    );
  };
  const save = async () => {
    if (!session || JSON.stringify(notes) === lastSaved.current) return;
    setSaving(true);
    setError('');
    try {
      await mutate({ type: 'notes', id: session.id, notes });
      lastSaved.current = JSON.stringify(notes);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your notes. Try again.');
      throw reason;
    } finally {
      setSaving(false);
    }
  };
  const leave = () => {
    void save()
      .then(close)
      .catch(() => undefined);
  };
  const end = () => {
    void save()
      .then(() => {
        setClock((old) => ({ ...old, running: false, elapsed }));
        if (session) finish(session);
        else
          saveStory({
            id: crypto.randomUUID(),
            title: current.prompt,
            competency: current.competency,
            situation: notes[current.id] ?? '',
            task: '',
            action: '',
            result: '',
            date: new Date().toISOString(),
          });
      })
      .catch(() => undefined);
  };
  return (
    <Modal
      title={
        session ? `A conversation with ${session.partner}.` : 'Find your words. Take your time.'
      }
      eyebrow={session ? 'YOUR GUIDED PEER SESSION' : 'A LITTLE SOLO PRACTICE'}
      onClose={leave}
      wide
    >
      <div className="row-between" style={{ marginBottom: 20 }}>
        <div className="role-switch">
          <button
            className={clock.role === 'answering' ? 'selected' : ''}
            onClick={() => setClock((old) => ({ ...old, role: 'answering' }))}
            aria-pressed={clock.role === 'answering'}
          >
            I’m answering
          </button>
          <button
            className={clock.role === 'interviewing' ? 'selected' : ''}
            onClick={() => setClock((old) => ({ ...old, role: 'interviewing' }))}
            aria-pressed={clock.role === 'interviewing'}
          >
            I’m interviewing
          </button>
        </div>
        {session?.link && (
          <a className="text-link" href={session.link} target="_blank" rel="noopener noreferrer">
            Open your call <ExternalLink size={14} />
          </a>
        )}
      </div>
      {session && !session.link && !demo && (
        <div className="intro-note">
          <p>
            Your meeting link hasn’t been added yet. Open session details to add your Meet or Zoom
            link before the call.
          </p>
        </div>
      )}
      <div className="practice-grid">
        <div>
          <div className="question-tags">
            <Badge tone="rose">{current.competency}</Badge>
            <Meta>
              QUESTION {clock.index + 1} OF {set.length}
            </Meta>
          </div>
          <div className="practice-progress" aria-hidden="true">
            {set.map((q, i) => (
              <span key={q.id} className={i <= clock.index ? 'done' : ''} />
            ))}
          </div>
          <p className="practice-question">{current.prompt}</p>
          {clock.role === 'interviewing' && (
            <div className="guidance-section">
              <h3>A little further, if they need a nudge</h3>
              <ol>
                {current.followUps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          )}
          <label>
            Your private notes
            <textarea
              value={notes[current.id] ?? ''}
              maxLength={10000}
              onChange={(event) => {
                setNotes((old) => ({ ...old, [current.id]: event.target.value }));
                setSaved(false);
              }}
              placeholder={
                clock.role === 'interviewing'
                  ? 'A moment that stood out, a follow-up to ask…'
                  : 'The experience you want to talk about, details worth remembering…'
              }
              rows={5}
            />
          </label>
          <div className="row-between" style={{ marginTop: 9 }}>
            <p className="saved-note">
              {session
                ? saved
                  ? 'Notes saved. Only you can see them.'
                  : 'Save your notes before switching devices.'
                : 'Turn these draft notes into a STAR story when you finish.'}
            </p>
            {session && (
              <button
                className="text-link"
                disabled={saving}
                onClick={() => void save().catch(() => undefined)}
              >
                {saving ? 'Saving…' : 'Save notes'}
                <Check size={13} />
              </button>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="practice-sidebar">
          <Meta>ANSWER TIMER</Meta>
          <div
            className="timer"
            role="timer"
            aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
          >
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </div>
          <div className="timer-controls">
            <button className="button button-small button-primary" onClick={toggleTimer}>
              {clock.running ? <Pause size={14} /> : <Play size={14} />}
              {clock.running ? 'Pause' : 'Start timer'}
            </button>
            <button
              className="icon-button"
              aria-label="Reset answer timer"
              onClick={() =>
                setClock((old) => ({ ...old, elapsed: 0, started: 0, running: false }))
              }
            >
              <RotateCcw size={16} />
            </button>
          </div>
          {seconds >= 180 && (
            <p className="timer-nudge">
              A gentle nudge: bring it back to the result. What changed because of you?
            </p>
          )}
          {clock.role === 'answering' ? (
            <>
              <Meta>A SIMPLE WAY TO SHAPE YOUR STORY</Meta>
              <div className="star-checklist" style={{ marginTop: 16 }} key={current.id}>
                {[
                  ['S', 'Situation', 'Set the scene.'],
                  ['T', 'Task', 'Name your responsibility.'],
                  ['A', 'Action', 'Make your part clear.'],
                  ['R', 'Result', 'Tell us what changed.'],
                ].map(([letter, title, text]) => (
                  <label className="checkbox-label" key={letter}>
                    <input type="checkbox" />
                    <span>
                      <strong>
                        {letter} · {title}
                      </strong>
                      <br />
                      {text}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="guidance-section">
              <h3>Listen for the whole story</h3>
              {rubric.map((item) => (
                <div className="rubric-row" key={item.score}>
                  <span>{item.score}</span>
                  <div>
                    <strong>{item.label}</strong>
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="form-note">
            {session
              ? 'Take turns: 20 minutes interviewing, then 5 minutes of feedback. Switch roles together on your call.'
              : 'This is self-guided practice. There is no recording or AI analysis.'}
          </p>
        </aside>
      </div>
      <div className="form-actions">
        <button className="button button-secondary left-action" onClick={leave} disabled={saving}>
          {session ? 'Save & close' : 'Close practice'}
        </button>
        {clock.index < set.length - 1 && (
          <button
            className="button button-secondary"
            onClick={() =>
              setClock((old) => ({
                ...old,
                index: old.index + 1,
                elapsed: 0,
                running: false,
                started: 0,
              }))
            }
          >
            Next question
            <ArrowRight size={15} />
          </button>
        )}
        <button className="button button-primary" disabled={saving} onClick={end}>
          {session ? 'Finish & give feedback' : 'Save as a story'}
          <ArrowRight size={15} />
        </button>
      </div>
      {demo && session && (
        <p className="form-note">
          Demo session · no real partner is connected. Notes and feedback stay in your browser.
        </p>
      )}
    </Modal>
  );
}
