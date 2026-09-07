import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFile, wallTimeToUtc } from '../lib/date';
import { safeMeetingLink, reduceWorkspace, workspaceSchema } from '../lib/model';
import { demoWorkspace } from '../lib/demo';
import { competencies, questions } from '../content/questions';

test('the question bank has 40 unique, fully scaffolded questions across six topics', () => {
  assert.equal(questions.length, 40);
  assert.equal(new Set(questions.map((q) => q.id)).size, 40);
  for (const topic of competencies)
    assert.ok(questions.filter((q) => q.competency === topic).length >= 6);
  for (const question of questions) {
    assert.ok(question.prompt.length > 20);
    assert.equal(question.followUps.length, 3);
    assert.equal(question.watchFor.length, 3);
  }
});
test('wall-clock conversion preserves timezone and daylight saving meaning', () => {
  assert.equal(wallTimeToUtc('2026-09-10', '18:00', 'America/Chicago'), '2026-09-10T23:00:00.000Z');
  assert.equal(wallTimeToUtc('2026-01-15', '18:00', 'America/Chicago'), '2026-01-16T00:00:00.000Z');
  assert.equal(wallTimeToUtc('2026-09-10', '18:00', 'Asia/Kolkata'), '2026-09-10T12:30:00.000Z');
  assert.throws(() => wallTimeToUtc('2026-03-08', '02:30', 'America/Chicago'), /does not exist/);
  assert.throws(() => wallTimeToUtc('2026-11-01', '01:30', 'America/Chicago'), /occurs twice/);
  assert.throws(() => wallTimeToUtc('2026-02-31', '18:00', 'America/Chicago'));
});
test('meeting links allow only HTTPS Meet and Zoom destinations', () => {
  for (const link of ['', 'https://meet.google.com/abc-defg-hij', 'https://us02web.zoom.us/j/123'])
    assert.equal(safeMeetingLink(link), true);
  for (const link of [
    'javascript:alert(1)',
    'http://meet.google.com/abc',
    'https://meet.google.com.evil.example/abc',
    'https://evilzoom.us/x',
    'https://user:password@meet.google.com/abc',
  ])
    assert.equal(safeMeetingLink(link), false);
});
test('calendar download contains the correct UTC time, duration, and escaped fields', () => {
  const sample = demoWorkspace().sessions[0];
  const ics = calendarFile({
    ...sample,
    startsAt: '2026-09-10T23:00:00.000Z',
    partner: 'Jordan, Lee\nBEGIN:VEVENT',
  });
  assert.ok(ics.includes('DTSTART:20260910T230000Z'));
  assert.ok(ics.includes('DTEND:20260911T000000Z'));
  assert.ok(ics.includes('Jordan\\, Lee\\nBEGIN:VEVENT'));
  assert.equal(ics.split('\r\nBEGIN:VEVENT').length, 2);
});
test('demo state is valid and clearing samples preserves user-created work', () => {
  const data = demoWorkspace();
  assert.equal(workspaceSchema.safeParse(data).success, true);
  const own = { ...data.stories[0], id: '20000000-0000-4000-8000-000000000001', sample: false };
  const next = reduceWorkspace(reduceWorkspace(data, { type: 'story', story: own }), {
    type: 'clearSamples',
  });
  assert.equal(next.stories.length, 1);
  assert.equal(next.stories[0].id, own.id);
  assert.equal(next.sessions.length, 0);
});
test('received feedback is preserved when a user submits their own review', () => {
  const data = demoWorkspace();
  const review = { ...data.reviews[0], id: 'mine', received: false, author: 'Me' };
  const once = reduceWorkspace(data, { type: 'review', review });
  const twice = reduceWorkspace(once, {
    type: 'review',
    review: { ...review, improvement: 'An updated specific next step.' },
  });
  assert.equal(twice.reviews.filter((r) => r.sessionId === review.sessionId).length, 2);
  assert.equal(
    twice.reviews.find((r) => r.id === 'mine')?.improvement,
    'An updated specific next step.',
  );
});
test('malformed saved state and unsafe links are rejected', () => {
  const data = demoWorkspace();
  assert.equal(workspaceSchema.safeParse({ ...data, stories: [{}] }).success, false);
  assert.equal(
    workspaceSchema.safeParse({
      ...data,
      sessions: [{ ...data.sessions[0], link: 'javascript:alert(1)' }],
    }).success,
    false,
  );
});
