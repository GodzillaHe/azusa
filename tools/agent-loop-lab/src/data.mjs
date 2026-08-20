export const projects = Object.freeze({
  azusa: Object.freeze({
    id: 'azusa',
    status: 'active',
    updatedAt: '2026-08-14',
    nextStep: 'Map existing modules to Agent engineering capabilities.',
  }),
  japanese: Object.freeze({
    id: 'japanese',
    status: 'active',
    updatedAt: '2026-08-14',
    nextStep: 'Practice long vowels, doubled consonants, and complete daily-life sentences.',
  }),
  metis: Object.freeze({
    id: 'metis',
    status: 'archived',
    updatedAt: '2026-08-14',
    nextStep: null,
  }),
});

export const recentEvents = Object.freeze({
  azusa: Object.freeze([
    Object.freeze({ date: '2026-08-14', type: 'decision', summary: 'Use Azusa as the practice workspace for becoming an Agent engineer.' }),
    Object.freeze({ date: '2026-08-10', type: 'review', summary: 'Avoid turning Azusa into an unbounded toolbox.' }),
  ]),
  japanese: Object.freeze([
    Object.freeze({ date: '2026-08-14', type: 'practice', summary: 'Basic particles and past-tense daily-life sentences were stable.' }),
  ]),
  metis: Object.freeze([
    Object.freeze({ date: '2026-08-14', type: 'decision', summary: 'Project was ended and archived.' }),
  ]),
});
