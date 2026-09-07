import { emptyWorkspace, type Workspace } from './model';
export function demoWorkspace(): Workspace {
  const relative = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
  };
  return {
    ...emptyWorkspace,
    profile: {
      name: 'Khalid',
      role: 'Software engineer',
      focus: 'Teamwork',
      timezone: 'America/Chicago',
      availability: ['Tue-18:00', 'Thu-18:00', 'Sun-15:00'],
      skipWeeks: [],
      onboarded: true,
    },
    savedQuestions: ['q-3-1', 'q-2-2'],
    sessions: [
      {
        id: 'sample-next',
        partner: 'Jordan Lee',
        partnerRole: 'Software engineer',
        startsAt: relative(3),
        timezone: 'America/Chicago',
        focus: 'Teamwork',
        link: '',
        status: 'upcoming',
        sample: true,
        questionIds: ['q-1-1', 'q-1-2', 'q-1-3'],
        notes: {},
      },
      ...(['Leadership', 'Ownership', 'Conflict'] as const).map((focus, i) => ({
        id: `sample-${i}`,
        partner: ['Alex Morgan', 'Sam Rivera', 'Taylor Kim'][i],
        partnerRole: 'Software engineer',
        startsAt: relative(-4 - i * 7),
        timezone: 'America/Chicago',
        focus,
        link: '',
        status: 'completed' as const,
        sample: true,
        questionIds: [`q-${i + 2}-1`],
        notes: {},
      })),
    ],
    stories: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        title: 'Helping a new teammate find their feet',
        competency: 'Leadership',
        situation: 'A new engineer joined during a busy release cycle.',
        task: 'Help them contribute confidently without slowing the release.',
        action:
          'I made a short onboarding guide, paired on their first ticket, and scheduled daily check-ins for a week.',
        result:
          'They shipped their first independent feature in week two. The guide became part of our onboarding.',
        date: relative(-4),
        sample: true,
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        title: 'Owning a delayed product launch',
        competency: 'Ownership',
        situation: 'I underestimated an integration during a product launch.',
        task: 'Reset expectations and find a realistic path to shipping.',
        action:
          'I flagged the delay early, split the release into two milestones, and gave stakeholders daily updates.',
        result:
          'We shipped the core experience three days later and completed the integration the following week.',
        date: relative(-11),
        sample: true,
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        title: 'Finding common ground on a technical decision',
        competency: 'Conflict',
        situation: 'A teammate and I preferred different approaches to a new service.',
        task: 'Choose an approach we could both support within our timeline.',
        action:
          'I suggested writing down our constraints, running a small experiment, and comparing results together.',
        result: 'We agreed on the simpler approach and documented when to revisit the decision.',
        date: relative(-18),
        sample: true,
      },
    ],
    reviews: [
      {
        id: 'review-1',
        sessionId: 'sample-0',
        author: 'Alex Morgan',
        received: true,
        score: 4,
        strength:
          'Your onboarding example made your leadership feel concrete. I could see exactly how you helped your teammate.',
        improvement:
          'Give the result a little more room. How quickly could your teammate work independently afterward?',
        sample: true,
      },
      {
        id: 'review-2',
        sessionId: 'sample-1',
        author: 'Sam Rivera',
        received: true,
        score: 4,
        strength:
          'You took clear responsibility for the launch delay and explained what you did next.',
        improvement:
          'Shorten the setup so you have more time for the decision you made and its impact.',
        sample: true,
      },
      {
        id: 'review-3',
        sessionId: 'sample-2',
        author: 'Taylor Kim',
        received: true,
        score: 3,
        strength: 'You listened to both sides before suggesting a way forward.',
        improvement: 'State your own position clearly before explaining the compromise.',
        sample: true,
      },
    ],
  };
}
