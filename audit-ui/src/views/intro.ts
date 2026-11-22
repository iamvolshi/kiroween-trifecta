/**
 * The intro block under a view's h1 (presentation only).
 * `view` names the view; the header strip reads it to show where you are.
 * `question` is a headline for the view; most views have none now, the h1
 * is the title. `how` is optional: a view with nothing to teach shows no
 * how-line. A view with neither shows no intro block at all.
 */
export const INTROS = {
  actions: {
    view: 'Action List',
  },
  record: {
    view: 'Record',
    how: 'Every entry per subject, oldest first.',
  },
  entry: {
    view: 'Entry Detail',
    how: 'One entry with all its fields, then the full chain for its KID and subject.',
  },
  notFound: {
    view: 'Not Found',
    question: 'This page does not exist.',
    how: 'Use the destinations on the left.',
  },
} as const;

export type IntroKey = keyof typeof INTROS;

export function createIntro(key: IntroKey): HTMLElement | null {
  const intro = INTROS[key];
  const { view } = intro;
  // `question`/`how` exist on only some entries; the `in` check narrows the union.
  const question = 'question' in intro ? intro.question : undefined;
  const how = 'how' in intro ? intro.how : undefined;
  if (!question && !how) return null;
  const box = document.createElement('div');
  box.className = 'view-intro';
  box.dataset.view = view;
  if (question) {
    const q = document.createElement('p');
    q.className = 'view-question';
    q.textContent = question;
    box.append(q);
  }
  if (how) {
    const h = document.createElement('p');
    h.className = 'view-how';
    h.textContent = how;
    box.append(h);
  }
  return box;
}

