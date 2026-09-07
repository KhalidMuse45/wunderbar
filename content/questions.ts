export const competencies = [
  'Teamwork',
  'Leadership',
  'Conflict',
  'Ownership',
  'Adaptability',
  'Communication',
] as const;
export type Competency = (typeof competencies)[number];
export type Question = {
  id: string;
  prompt: string;
  competency: Competency;
  difficulty: string;
  followUps: string[];
  watchFor: string[];
};
const groups: {
  competency: Competency;
  prompts: string[];
  followUps: string[];
  watchFor: string[];
}[] = [
  {
    competency: 'Teamwork',
    prompts: [
      'Tell me about a time you worked with someone whose approach was different from yours.',
      'Describe a project where collaboration made the difference.',
      'Tell me about a time you helped a teammate who was falling behind.',
      'How have you built trust with a new team?',
      'Describe a time you gave credit to someone else.',
      'Tell me about a time you worked across teams to solve a problem.',
      'When did asking for help improve your work?',
    ],
    followUps: [
      'What was your specific contribution?',
      'How did you make room for the other person’s perspective?',
      'What did you achieve together that you could not have achieved alone?',
    ],
    watchFor: [
      'Saying “we” without explaining an individual contribution',
      'Equating collaboration with dividing tasks',
      'Leaving the outcome unclear',
    ],
  },
  {
    competency: 'Leadership',
    prompts: [
      'Tell me about a time you led a team through uncertainty.',
      'Describe a time you influenced a decision without formal authority.',
      'Tell me about a time you helped someone else grow.',
      'When have you had to make an unpopular decision?',
      'Describe a time you brought a struggling team together.',
      'Tell me about a time you delegated something important.',
      'How have you made space for a quieter voice on your team?',
    ],
    followUps: [
      'What did you personally do to give the team direction?',
      'How did you know your approach was working?',
      'What would you change about your approach now?',
    ],
    watchFor: [
      'Taking all the credit for a shared outcome',
      'Describing a title instead of an action',
      'Not explaining how others responded',
    ],
  },
  {
    competency: 'Conflict',
    prompts: [
      'Tell me about a time you disagreed with a teammate.',
      'Describe a time you pushed back on your manager’s decision.',
      'Tell me about a time you received feedback you disagreed with.',
      'How have you handled competing priorities between stakeholders?',
      'Describe a time you resolved a misunderstanding.',
      'Tell me about a time you had a difficult conversation.',
      'When have you changed your mind during a disagreement?',
    ],
    followUps: [
      'What was your position, in one sentence?',
      'How would the other person describe the disagreement?',
      'What changed in the working relationship afterward?',
    ],
    watchFor: [
      'Blaming the other person',
      'Avoiding the actual disagreement',
      'Skipping reflection or resolution',
    ],
  },
  {
    competency: 'Ownership',
    prompts: [
      'Tell me about a time you took initiative beyond your responsibilities.',
      'Describe a mistake you made and how you handled it.',
      'Tell me about a project you saw through from beginning to end.',
      'When have you had to deliver with limited resources?',
      'Describe a time you identified a problem nobody else noticed.',
      'Tell me about a time you missed a deadline.',
      'How have you balanced doing something quickly with doing it well?',
    ],
    followUps: [
      'Which decisions were yours to make?',
      'How did you communicate the risks or mistakes?',
      'What concrete result came from your actions?',
    ],
    watchFor: [
      'Shifting responsibility',
      'Leaving out the impact',
      'Describing effort without a result',
    ],
  },
  {
    competency: 'Adaptability',
    prompts: [
      'Tell me about a time your plans changed unexpectedly.',
      'Describe a time you had to learn something quickly.',
      'Tell me about a failure that changed how you work.',
      'When have you worked outside your comfort zone?',
      'Describe a time you made a decision with incomplete information.',
      'How have you handled a major change in priorities?',
    ],
    followUps: [
      'What was the first thing you did when the situation changed?',
      'What tradeoff did you make?',
      'How have you used what you learned since then?',
    ],
    watchFor: [
      'Claiming everything went smoothly',
      'Not explaining the adjustment',
      'A lesson without a later application',
    ],
  },
  {
    competency: 'Communication',
    prompts: [
      'Tell me about a time you explained something complex to a nontechnical audience.',
      'Describe a time you had to deliver difficult news.',
      'Tell me about a time your communication prevented a problem.',
      'How have you persuaded someone to try a new approach?',
      'Describe a time you adapted your message for a different audience.',
      'Tell me about a time you realized you were not being understood.',
    ],
    followUps: [
      'What did your audience need to understand?',
      'How did you check that your message landed?',
      'What did you change based on their response?',
    ],
    watchFor: [
      'Jargon without explanation',
      'Assuming understanding without checking',
      'Describing only one-way communication',
    ],
  },
];
export const questions: Question[] = groups.flatMap((group, g) =>
  group.prompts.map((prompt, i) => ({
    id: `q-${g + 1}-${i + 1}`,
    prompt,
    competency: group.competency,
    difficulty: i < 2 ? 'Warm-up' : i < 5 ? 'Reflective' : 'Challenging',
    followUps: group.followUps,
    watchFor: group.watchFor,
  })),
);
export const rubric = [
  {
    score: 1,
    label: 'Keep exploring',
    description:
      'The situation or your own contribution is still unclear. Find one specific moment to build on.',
  },
  {
    score: 3,
    label: 'A solid foundation',
    description:
      'A clear situation and action, with room to make the outcome or reflection more concrete.',
  },
  {
    score: 5,
    label: 'A story that lands',
    description:
      'A specific example, clear individual actions, a meaningful outcome, and thoughtful reflection.',
  },
];
