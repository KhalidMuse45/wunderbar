import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedStarts } from '../lib/availability';
import { monday } from '../lib/date';
import { sessionPhase, checkOutcome } from '../lib/sessions';
import {
  profileSchema,
  emptyWorkspace,
  reduceWorkspace,
  type Member,
  type Session,
} from '../lib/model';

const member = (timezone: string, availability: string[], skipWeeks: string[] = []): Member => ({
  id: timezone,
  name: timezone,
  role: 'Engineer',
  focus: 'Teamwork',
  timezone,
  availability,
  skipWeeks,
});
test('custom start times preserve old slots and support quarter-hour offsets', () => {
  for (const slot of ['Mon-09:00', 'Tue-10:30', 'Wed-23:45'])
    assert.equal(
      profileSchema.safeParse({ ...emptyWorkspace.profile, name: 'Morgan', availability: [slot] })
        .success,
      true,
    );
  for (const slot of ['Mon-24:00', 'Tue-10:07', 'Wed-09:60'])
    assert.equal(
      profileSchema.safeParse({ ...emptyWorkspace.profile, name: 'Morgan', availability: [slot] })
        .success,
      false,
    );
});
test('shared start suggestions match Chicago/New York and fractional-offset timezones', () => {
  const now = new Date('2026-09-09T00:00:00Z');
  assert.deepEqual(
    sharedStarts(
      member('America/Chicago', ['Thu-09:00']),
      member('America/New_York', ['Thu-10:00']),
      now,
      3,
    ),
    ['2026-09-10T14:00:00.000Z'],
  );
  assert.deepEqual(
    sharedStarts(member('UTC', ['Thu-09:00']), member('Asia/Kolkata', ['Thu-14:30']), now, 3),
    ['2026-09-10T09:00:00.000Z'],
  );
  assert.deepEqual(
    sharedStarts(member('UTC', ['Thu-09:00']), member('Asia/Kathmandu', ['Thu-14:45']), now, 3),
    ['2026-09-10T09:00:00.000Z'],
  );
  assert.deepEqual(
    sharedStarts(
      member('America/Chicago', ['Thu-09:00']),
      member('America/New_York', ['Thu-09:00']),
      now,
      3,
    ),
    [],
  );
});
test('suggestions respect skipped local weeks, DST gaps, and repeated hours for either member', () => {
  assert.equal(monday(new Date('2026-09-07T00:30:00Z'), 'America/Chicago'), '2026-08-31');
  assert.equal(monday(new Date('2026-09-07T00:30:00Z'), 'Asia/Tokyo'), '2026-09-07');
  assert.deepEqual(
    sharedStarts(
      member('UTC', ['Thu-09:00']),
      member('UTC', ['Thu-09:00'], ['2026-09-07']),
      new Date('2026-09-09T00:00:00Z'),
      3,
    ),
    [],
  );
  assert.deepEqual(
    sharedStarts(
      member('America/New_York', ['Sun-02:30']),
      member('UTC', ['Sun-07:30']),
      new Date('2026-03-08T00:00:00Z'),
      2,
    ),
    [],
  );
  assert.deepEqual(
    sharedStarts(
      member('UTC', ['Sun-05:30']),
      member('America/New_York', ['Sun-01:30']),
      new Date('2026-11-01T00:00:00Z'),
      1,
    ),
    [],
  );
});
const session: Session = {
  id: 'test',
  partner: 'Partner',
  partnerRole: 'Engineer',
  startsAt: '2026-09-09T09:00:00Z',
  timezone: 'UTC',
  focus: 'Teamwork',
  link: '',
  status: 'upcoming',
  questionIds: ['q-1-1'],
  notes: {},
};
test('elapsed sessions need an explicit outcome, and feedback does not change it', () => {
  assert.equal(sessionPhase(session, Date.parse('2026-09-09T09:59:59Z')), 'upcoming');
  assert.equal(sessionPhase(session, Date.parse('2026-09-09T10:00:00Z')), 'awaiting_outcome');
  assert.throws(
    () => checkOutcome(session, 'completed', Date.parse('2026-09-09T09:30:00Z')),
    /scheduled hour/,
  );
  assert.doesNotThrow(() => checkOutcome(session, 'completed', Date.parse('2026-09-09T10:00:00Z')));
  assert.throws(
    () =>
      checkOutcome(
        { ...session, status: 'no_show' },
        'completed',
        Date.parse('2026-09-09T11:00:00Z'),
      ),
    /different outcome/,
  );
  const review = {
    id: 'review',
    sessionId: 'test',
    author: 'Morgan',
    received: false,
    score: 4,
    strength: 'A clear example.',
    improvement: 'Add a specific result.',
  };
  assert.throws(
    () => reduceWorkspace({ ...emptyWorkspace, sessions: [session] }, { type: 'review', review }),
    /completed session/,
  );
  const result = reduceWorkspace(
    { ...emptyWorkspace, sessions: [{ ...session, status: 'completed' }] },
    { type: 'review', review },
  );
  assert.equal(result.sessions[0].status, 'completed');
  assert.equal(result.reviews.length, 1);
});
