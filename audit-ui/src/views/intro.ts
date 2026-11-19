/**
 * The question a view answers, shown under its h1 (presentation only).
 * `view` names the view; the header strip reads it to show where you are.
 */
export const INTROS = {
  actions: {
    view: 'Action List',
    question: 'What did the agent do?',
    how: 'Every record entry, newest first. Each card shows authority and state, what changed, why, and when.',
  },
  chat: {
    view: 'Chat / Observability',
    question: 'Who do you want to talk to?',
    how: 'ARCHE runs the persona you choose. Pick one, then send a message. The right column shows what the engines did.',
  },
  timeTravel: {
    view: 'Time Travel',
    question: 'What did it believe at that moment?',
    how: 'Pick a moment in UTC. You see every entry that was live then, and nothing else.',
  },
  calendar: {
    view: 'Calendar',
    question: 'When did it act, and what did it believe then?',
    how: 'Dots mark days with record entries. Open a day, then an hour.',
  },
  record: {
    view: 'Record',
    question: 'What does the record hold for this account?',
    how: 'Every entry per subject, oldest first.',
  },
  entry: {
    view: 'Entry Detail',
    question: 'What exactly was recorded?',
    how: 'One entry with all its fields, then the full chain for its KID and subject.',
  },
  notFound: {
    view: 'Not Found',
    question: 'This page does not exist.',
    how: 'Use the destinations on the left.',
  },
} as const;

export type IntroKey = keyof typeof INTROS;

export function createIntro(key: IntroKey): HTMLElement {
  const { view, question, how } = INTROS[key];
  const box = document.createElement('div');
  box.className = 'view-intro';
  box.dataset.view = view;
  const q = document.createElement('p');
  q.className = 'view-question';
  q.textContent = question;
  const h = document.createElement('p');
  h.className = 'view-how';
  h.textContent = how;
  box.append(q, h);
  return box;
}
