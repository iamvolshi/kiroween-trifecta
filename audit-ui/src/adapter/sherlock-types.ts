// The shapes of the Sherlock search service (docs: sherlock-search-contract.md
// in the NewSherlock repo). Corpus reads only; the seam shapes live in seam.ts.

export interface CaseStatus {
  case_id: string;
  name: string;
  ready: boolean;
  entry_count: number;
  word_count: number;
}

export interface OverviewSection {
  name: string;
  kind: string;
  start_kid: number;
  end_kid: number;
  word_count: number;
  opening: string;
}

export interface CorpusOverview {
  case_id: string;
  source: string;
  word_count: number;
  char_count: number;
  entry_count: number;
  sections: OverviewSection[];
  top_terms: Array<{ term: string; count: number }>;
  opening_excerpt: string;
  closing_excerpt: string;
  built_by: string;
}

export interface CorpusNoun {
  noun: string;
  kind: string;
  count: number;
  first_kid: number;
  kids: number[];
}

export interface CorpusNouns {
  case_id: string;
  count: number;
  nouns: CorpusNoun[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  kids: number[];
}

export interface CorpusGraph {
  case_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  built_by: string;
}

/** The corpus views' reads (overview, nouns, graph), each in words on failure. */
export interface CorpusReads {
  overview(): Promise<{ ok: true; data: CorpusOverview } | { ok: false; error: string }>;
  nouns(): Promise<{ ok: true; data: CorpusNouns } | { ok: false; error: string }>;
  graph(): Promise<{ ok: true; data: CorpusGraph } | { ok: false; error: string }>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isOverview(v: unknown): v is CorpusOverview {
  return (
    isObj(v) && isStr(v.source) && isNum(v.word_count) && isNum(v.entry_count) &&
    Array.isArray(v.sections) && v.sections.every((s) => isObj(s) && isStr(s.name) && isNum(s.start_kid) && isNum(s.end_kid) && isNum(s.word_count)) &&
    Array.isArray(v.top_terms) && v.top_terms.every((t) => isObj(t) && isStr(t.term) && isNum(t.count))
  );
}

export function isNouns(v: unknown): v is CorpusNouns {
  return (
    isObj(v) && Array.isArray(v.nouns) &&
    v.nouns.every((n) => isObj(n) && isStr(n.noun) && isStr(n.kind) && isNum(n.count) && Array.isArray(n.kids))
  );
}

export function isGraph(v: unknown): v is CorpusGraph {
  return (
    isObj(v) && Array.isArray(v.nodes) && Array.isArray(v.edges) &&
    v.nodes.every((n) => isObj(n) && isStr(n.id) && isStr(n.label) && isNum(n.count)) &&
    v.edges.every((e) => isObj(e) && isStr(e.source) && isStr(e.target) && isNum(e.weight))
  );
}
