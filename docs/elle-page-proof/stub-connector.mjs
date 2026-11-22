// A STUB connector (test double) for the ELLE page proof shots only. It is
// never imported by app code and holds no real record: every value below is
// a stand-in, named as such. Usage: node stub-connector.mjs <port>
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8799);
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const entry = (i, subject, authority, reason) => ({
  id: `stub-${i}`, kid: i, subject, state: 'WILD', authority, pool: '0',
  k_start: iso(now - (10 - i) * 60_000), t_time: iso(now - (10 - i) * 60_000),
  e_time: '', k_time: '', evidence: `stub evidence ${i}`, reason, prev_hash: '',
});
const ENTRIES = [
  entry(1, 'stub-letter-1', 5, 'stub: source text'),
  entry(2, 'stub-chapter-1', 5, 'stub: source text'),
  entry(3, 'stub-chapter-2', 7, 'stub: source text'),
  entry(4, 'turn', 5, 'user turn (reply)'),
  entry(5, 'turn', 5, 'assistant turn (reply)'),
];
const lesson = (id, detail, status, subject = null) => ({ event_id: id, event_type: 'derived', detail, rule: null, subject, status });
// Stand-in lessons: two filed subjects, one unfiled; candidates and promoted.
const LESSONS = [
  lesson('stub-lesson-1', 'stub: the user asks about the source', 'promoted', 'stub-subject-a'),
  lesson('stub-lesson-2', 'stub: under threshold, a question for ELLE', 'candidate', 'stub-subject-a'),
  lesson('stub-lesson-3', 'stub: a second subject, still held', 'candidate', 'stub-subject-b'),
  lesson('stub-lesson-4', 'stub: a lesson with no subject', 'promoted'),
];
let turns = 0;

function chat(message) {
  turns += 1;
  const found = turns % 2 === 1;
  return {
    message, known: found, step: null, total_steps: 0,
    served_by: { provider: 'stub-provider', model: 'stub-model' },
    engines: {
      arche: { reply: found ? 'Stub reply grounded in stub-chapter-2.' : 'Stub reply: nothing on record.' },
      erie: found
        ? {
            question: message, state: 'found', text: 'stub chapter two text: the stub source answers the question',
            provenance: [
              { source: 'K-record day 20412 tick 2, Stub Author', content: 'stub-3', excerpt: 'stub chapter two text: the stub source answers the question' },
              { source: 'K-record day 20412 tick 1, Stub Author', content: 'stub-2', excerpt: 'stub chapter one text' },
            ],
          }
        : { question: message, state: 'not_found', text: '', provenance: [] },
      elle: found ? null : LESSONS[2],
      elle_promoted: found ? LESSONS[0] : null,
      lessons_in_prompt: {
        subjects: [],
        injected: found ? [lesson('stub-lesson-1', 'stub: the user asks about the source', 'promoted')] : [],
        held: [lesson('stub-lesson-2', 'stub: under threshold, a question for ELLE', 'candidate')],
      },
      katie: [{ kid: 6, subject: 'turn', entry_id: `stub-turn-${turns}`, seated: true }],
    },
  };
}

const MODELS = {
  persona: 'entity', personas: ['Frankenstein'],
  default: { provider: 'stub-provider', model: 'stub-model' },
  registers: { book: { provider: 'stub-provider', model: 'stub-model' }, movie: { provider: 'stub-provider', model: 'stub-model' }, 'young-frankenstein': { provider: 'stub-provider', model: 'stub-model' } },
  register_voices: ['book', 'movie', 'young-frankenstein'],
};

createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, {});
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') return send(200, { ok: true, personas: ['frankenstein'] });
  if (url.pathname === '/models') return send(200, MODELS);
  if (url.pathname === '/entries' || url.pathname === '/belief-pool') return send(200, ENTRIES);
  if (url.pathname === '/kidmap') return send(200, Object.fromEntries(ENTRIES.map((e) => [String(e.kid), `stub-tag-${e.kid}`])));
  if (url.pathname === '/lessons') return send(200, LESSONS);
  if (url.pathname === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => send(200, chat(JSON.parse(body).message)));
    return;
  }
  send(404, { error: 'not served by the stub' });
}).listen(port, '127.0.0.1', () => console.log(`stub connector on http://127.0.0.1:${port}`));
