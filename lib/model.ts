import { z } from 'zod';
import { competencies } from '@/content/questions';
export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const slotTimes = ['09:00', '12:00', '15:00', '18:00'];
export const timezones = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];
export const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Choose a valid timezone.');
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Add your name.').max(70),
  role: z.string().trim().min(1).max(100),
  focus: z.enum(competencies),
  timezone: timezoneSchema,
  onboarded: z.boolean(),
  availability: z
    .array(z.string().regex(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(09|12|15|18):00$/))
    .max(28),
  skipWeeks: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(52),
});
export const storySchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(150),
  competency: z.enum(competencies),
  situation: z.string().max(10000),
  task: z.string().max(10000),
  action: z.string().max(10000),
  result: z.string().max(10000),
  date: z.string().datetime(),
  sample: z.boolean().optional(),
});
export function safeMeetingLink(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'meet.google.com' ||
        url.hostname === 'zoom.us' ||
        url.hostname.endsWith('.zoom.us'))
    );
  } catch {
    return false;
  }
}
export const meetingSchema = z
  .string()
  .max(500)
  .refine(safeMeetingLink, 'Use an HTTPS Google Meet or Zoom link.');
export const sessionSchema = z.object({
  id: z.string(),
  partner: z.string(),
  partnerRole: z.string(),
  startsAt: z.string().datetime(),
  timezone: timezoneSchema,
  focus: z.enum(competencies),
  link: meetingSchema,
  status: z.enum(['upcoming', 'completed', 'cancelled']),
  sample: z.boolean().optional(),
  questionIds: z.array(z.string()),
  notes: z.record(z.string()),
});
export const reviewSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  author: z.string(),
  received: z.boolean(),
  score: z.number().int().min(1).max(5),
  strength: z
    .string()
    .trim()
    .min(10, 'Reference a specific moment (at least 10 characters).')
    .max(3000),
  improvement: z
    .string()
    .trim()
    .min(10, 'Give one specific next step (at least 10 characters).')
    .max(3000),
  sample: z.boolean().optional(),
});
export const ideaSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(140),
  body: z.string().min(10).max(3000),
  date: z.string(),
  status: z.string(),
});
export const workspaceSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  sessions: z.array(sessionSchema),
  stories: z.array(storySchema),
  reviews: z.array(reviewSchema),
  savedQuestions: z.array(z.string()),
  ideas: z.array(ideaSchema),
});
export type Profile = z.infer<typeof profileSchema>;
export type Story = z.infer<typeof storySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Member = {
  id: string;
  name: string;
  role: string;
  focus: string;
  timezone: string;
  availability: string[];
  skipWeeks: string[];
};
export type Action =
  | { type: 'profile'; profile: Profile }
  | { type: 'story'; story: Story }
  | { type: 'deleteStory'; id: string }
  | { type: 'bookmark'; id: string }
  | { type: 'schedule'; session: Session; hostId?: string; guestId?: string }
  | { type: 'notes'; id: string; notes: Record<string, string> }
  | { type: 'cancel'; id: string }
  | { type: 'link'; id: string; link: string }
  | { type: 'review'; review: Review }
  | { type: 'idea'; idea: Idea }
  | { type: 'clearSamples' };
export const emptyWorkspace: Workspace = {
  version: 1,
  profile: {
    name: '',
    role: 'Software engineer',
    focus: 'Teamwork',
    timezone: 'America/Chicago',
    availability: [],
    skipWeeks: [],
    onboarded: false,
  },
  sessions: [],
  stories: [],
  reviews: [],
  savedQuestions: [],
  ideas: [],
};
export function reduceWorkspace(state: Workspace, action: Action): Workspace {
  switch (action.type) {
    case 'profile':
      return { ...state, profile: action.profile };
    case 'story':
      return {
        ...state,
        stories: [action.story, ...state.stories.filter((story) => story.id !== action.story.id)],
      };
    case 'deleteStory':
      return { ...state, stories: state.stories.filter((story) => story.id !== action.id) };
    case 'bookmark':
      return {
        ...state,
        savedQuestions: state.savedQuestions.includes(action.id)
          ? state.savedQuestions.filter((id) => id !== action.id)
          : [...state.savedQuestions, action.id],
      };
    case 'schedule':
      return { ...state, sessions: [action.session, ...state.sessions] };
    case 'notes':
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.id ? { ...session, notes: action.notes } : session,
        ),
      };
    case 'cancel':
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.id ? { ...session, status: 'cancelled' } : session,
        ),
      };
    case 'link':
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.id ? { ...session, link: action.link } : session,
        ),
      };
    case 'review':
      return {
        ...state,
        reviews: [
          ...state.reviews.filter(
            (review) => review.sessionId !== action.review.sessionId || review.received,
          ),
          action.review,
        ],
        sessions: state.sessions.map((session) =>
          session.id === action.review.sessionId ? { ...session, status: 'completed' } : session,
        ),
      };
    case 'idea':
      return { ...state, ideas: [action.idea, ...state.ideas] };
    case 'clearSamples':
      return {
        ...state,
        sessions: state.sessions.filter((s) => !s.sample),
        stories: state.stories.filter((s) => !s.sample),
        reviews: state.reviews.filter((r) => !r.sample),
      };
  }
}
