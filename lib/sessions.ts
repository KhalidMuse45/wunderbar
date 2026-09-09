import type { Session } from './model';

export function sessionPhase(session: Session, now = Date.now()) {
  return session.status === 'upcoming' && Date.parse(session.startsAt) + 3600000 <= now
    ? ('awaiting_outcome' as const)
    : session.status;
}

export const sessionLabels = {
  upcoming: 'Upcoming',
  awaiting_outcome: 'Needs outcome',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Did not take place',
};

export function checkOutcome(session: Session, outcome: 'completed' | 'no_show', now = Date.now()) {
  if (session.status === 'cancelled') throw new Error('This session was cancelled.');
  if (Date.parse(session.startsAt) + 3600000 > now)
    throw new Error('You can record the outcome after the scheduled hour ends.');
  if (session.status !== 'upcoming' && session.status !== outcome)
    throw new Error('This session already has a different outcome.');
}
