// SCENARIO SCRIPT -- MOCK DATA. Every value, hash and source here is scripted
// and labeled mock. No engine, no model, no randomness.
// Account order-1042, a parcel delivery, day 2026-11-16 (UTC). KIDs 4 and 5.
// Entries still current close at the mock window end (GRAY-1).

import type { Entry } from '../adapter/seam.ts';
import type { Scenario, ScenarioStep } from './types.ts';

const ACCOUNT = 'order-1042';
const POOL = 'pool-mock-scenario';
const WINDOW_END = '2026-11-17T00:00:00.000Z';

function at(hhmm: string): string {
  return `2026-11-16T${hhmm}:00.000Z`;
}

function before(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m - 1;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return at(`${hh}:${mm}`);
}

function entry(
  id: string,
  kid: number,
  subject: string,
  state: string,
  authority: number,
  start: string,
  end: string | null,
  value: string,
  reason: string,
  prevHash: string,
): Entry {
  return {
    id,
    kid,
    subject,
    state,
    authority,
    pool: POOL,
    k_start: at(start),
    t_time: at(start),
    e_time: before(start),
    k_time: end === null ? WINDOW_END : at(end),
    evidence: `value=${value} (mock)`,
    reason,
    prev_hash: prevHash,
  };
}

const NOT_KNOWING = "I don't know. The script has no answer for that. (mock)";

const STEPS: ScenarioStep[] = [
  {
    step: 1,
    prompt: 'When will my order arrive?',
    keywords: ['arrive', 'arriving', 'delivery'],
    reply: 'Your order is due on 2026-11-18, according to the order system. (mock)',
    erie: {
      question: 'When will my order arrive?',
      state: 'found',
      text: 'The order system lists delivery on 2026-11-18. (mock)',
      provenance: [
        {
          source: 'mock:order-system',
          content: 'order-1042',
          excerpt: 'delivery_date: 2026-11-18 (mock)',
        },
      ],
    },
    elle: null,
    entries: [
      entry('scn-s1', 4, 'order-1042.delivery_date', 'confirmed', 6, '09:12', '14:30',
        '2026-11-18', 'Order system gives the delivery date.', 'mock:genesis'),
    ],
  },
  {
    step: 2,
    prompt: 'Where is the parcel now?',
    keywords: ['where', 'parcel', 'tracking'],
    reply: 'The carrier feed shows the parcel in transit. (mock)',
    erie: {
      question: 'Where is the parcel now?',
      state: 'found',
      text: 'The carrier feed shows parcel-77 in transit. (mock)',
      provenance: [
        {
          source: 'mock:carrier-feed',
          content: 'parcel-77',
          excerpt: 'status: in transit (mock)',
        },
      ],
    },
    elle: null,
    entries: [
      entry('scn-s2', 5, 'parcel-77.status', 'confirmed', 7, '10:05', '15:10',
        'in transit', 'Carrier feed shows the parcel moving.', 'mock:genesis'),
    ],
  },
  {
    step: 3,
    prompt: 'The carrier emailed me about a delay.',
    keywords: ['delay', 'delayed', 'late'],
    reply: 'Thanks for telling me. The delivery date moves to 2026-11-19. (mock)',
    erie: {
      question: 'The carrier emailed me about a delay.',
      state: 'found',
      text: 'The carrier notice says delivery is delayed to 2026-11-19. (mock)',
      provenance: [
        {
          source: 'mock:carrier-notice',
          content: 'order-1042',
          excerpt: 'new delivery date: 2026-11-19 (mock)',
        },
      ],
    },
    elle: null,
    entries: [
      entry('scn-s3', 4, 'order-1042.delivery_date', 'revised', 7, '14:30', null,
        '2026-11-19', 'Carrier notice moved the delivery date.', 'mock:hash-s1'),
    ],
  },
  {
    step: 4,
    prompt: 'Thanks. What did you learn?',
    keywords: ['thanks', 'thank', 'learn', 'learned'],
    reply: 'I learned to check the carrier feed before promising a date. (mock)',
    erie: null,
    elle: {
      event_id: 'mock:lesson-1',
      event_type: 'trifecta.chat',
      detail: 'The first delivery date was replaced after a carrier delay notice. (mock)',
      rule: 'Check the carrier feed before promising a delivery date.',
    },
    entries: [
      entry('scn-s4', 5, 'parcel-77.status', 'revised', 8, '15:10', null,
        'held at depot', 'Carrier feed shows the parcel held at the depot.', 'mock:hash-s2'),
    ],
  },
];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export const SCENARIO: Scenario = deepFreeze({
  account_id: ACCOUNT,
  steps: STEPS,
  kid_labels: { 4: 'order-1042 (mock)', 5: 'parcel-77 (mock)' },
  not_knowing_reply: NOT_KNOWING,
});
