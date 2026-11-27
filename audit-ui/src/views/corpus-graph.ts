import type { CorpusGraph, GraphEdge, GraphNode } from '../adapter/sherlock-types.ts';

/**
 * The corpus graph, drawn as SVG with no library. Nodes are Sherlock's nouns,
 * edges are passages where two nouns meet. Layout is a plain spring layout run
 * a fixed number of steps from a fixed start, so the same graph always draws
 * the same way. shortcut: only the top MAX_NODES nouns are drawn (the page says
 * how many were left out); past a few hundred nodes this wants a real layout.
 */

export const MAX_NODES = 40;
const W = 960;
const H = 640;
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Placed {
  node: GraphNode;
  x: number;
  y: number;
  r: number;
}

/** The top nodes by count, and the edges whose both ends are among them. */
export function pick(graph: CorpusGraph, max = MAX_NODES): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = [...graph.nodes].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, max);
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target) };
}

/** Fixed-step spring layout: repulsion between all, attraction along edges, a pull to the middle. */
export function layout(nodes: GraphNode[], edges: GraphEdge[]): Placed[] {
  const top = Math.max(1, ...nodes.map((n) => n.count));
  const placed: Placed[] = nodes.map((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, nodes.length);
    return { node, x: W / 2 + Math.cos(a) * 220, y: H / 2 + Math.sin(a) * 200, r: 5 + 13 * Math.sqrt(node.count / top) };
  });
  const at = new Map(placed.map((p) => [p.node.id, p]));
  const maxW = Math.max(1, ...edges.map((e) => e.weight));
  for (let step = 0; step < 220; step++) {
    const cool = 1 - step / 220;
    const dx = placed.map(() => 0);
    const dy = placed.map(() => 0);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!, b = placed[j]!;
        let ex = a.x - b.x, ey = a.y - b.y;
        let d = Math.hypot(ex, ey);
        if (d < 0.01) { ex = 0.01 * (i + 1); ey = 0.01; d = Math.hypot(ex, ey); }
        const f = (2600 + (a.r + b.r) * 40) / (d * d);
        dx[i]! += (ex / d) * f; dy[i]! += (ey / d) * f;
        dx[j]! -= (ex / d) * f; dy[j]! -= (ey / d) * f;
      }
    }
    for (const e of edges) {
      const a = at.get(e.source), b = at.get(e.target);
      if (!a || !b) continue;
      const i = placed.indexOf(a), j = placed.indexOf(b);
      const ex = b.x - a.x, ey = b.y - a.y;
      const d = Math.max(1, Math.hypot(ex, ey));
      const f = (d - 90) * 0.012 * (0.4 + e.weight / maxW);
      dx[i]! += (ex / d) * f; dy[i]! += (ey / d) * f;
      dx[j]! -= (ex / d) * f; dy[j]! -= (ey / d) * f;
    }
    placed.forEach((p, i) => {
      dx[i]! += (W / 2 - p.x) * 0.004;
      dy[i]! += (H / 2 - p.y) * 0.004;
      const m = Math.hypot(dx[i]!, dy[i]!);
      const cap = 14 * cool + 0.5;
      const k = m > cap ? cap / m : 1;
      p.x = Math.min(W - 40, Math.max(40, p.x + dx[i]! * k));
      p.y = Math.min(H - 24, Math.max(24, p.y + dy[i]! * k));
    });
  }
  return placed;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/** The graph as an SVG element. Hover or focus a noun to see its neighbours; each noun carries a title. */
export function renderGraphSvg(graph: CorpusGraph): SVGSVGElement {
  const { nodes, edges } = pick(graph);
  const placed = layout(nodes, edges);
  const at = new Map(placed.map((p) => [p.node.id, p]));
  const maxW = Math.max(1, ...edges.map((e) => e.weight));
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'corpus-graph-svg', role: 'img' });
  root.setAttribute('aria-label', `Noun graph: ${nodes.length} nouns, ${edges.length} links`);
  const links = svg('g', { class: 'cg-edges' });
  for (const e of edges) {
    const a = at.get(e.source)!, b = at.get(e.target)!;
    const line = svg('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      'stroke-width': (0.6 + 2.6 * (e.weight / maxW)).toFixed(2),
      class: 'cg-edge',
    });
    line.dataset.a = e.source;
    line.dataset.b = e.target;
    const t = svg('title', {});
    t.textContent = `${e.source} + ${e.target}: together in ${e.weight} ${e.weight === 1 ? 'passage' : 'passages'}`;
    line.appendChild(t);
    links.appendChild(line);
  }
  const dots = svg('g', { class: 'cg-nodes' });
  for (const p of placed) {
    const g = svg('g', { class: `cg-node kind-${p.node.kind}`, tabindex: 0, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` });
    g.dataset.id = p.node.id;
    const t = svg('title', {});
    t.textContent = `${p.node.label} (${p.node.kind}): in ${p.node.count} ${p.node.count === 1 ? 'passage' : 'passages'}`;
    const label = svg('text', { y: -p.r - 3, 'text-anchor': 'middle', class: 'cg-label' });
    label.textContent = p.node.label;
    g.append(t, svg('circle', { r: p.r.toFixed(1) }), label);
    const focus = (on: boolean): void => {
      const near = new Set<string>([p.node.id]);
      for (const e of edges) if (e.source === p.node.id || e.target === p.node.id) { near.add(e.source); near.add(e.target); }
      root.classList.toggle('is-focus', on);
      for (const n of dots.children) (n as SVGElement).classList.toggle('is-near', on && near.has((n as SVGElement).dataset.id ?? ''));
      for (const l of links.children) (l as SVGElement).classList.toggle('is-near', on && (l as SVGElement).dataset.a !== undefined && (near.has((l as SVGElement).dataset.a!) && near.has((l as SVGElement).dataset.b!)) && ((l as SVGElement).dataset.a === p.node.id || (l as SVGElement).dataset.b === p.node.id));
    };
    g.addEventListener('mouseenter', () => focus(true));
    g.addEventListener('mouseleave', () => focus(false));
    g.addEventListener('focus', () => focus(true));
    g.addEventListener('blur', () => focus(false));
    dots.appendChild(g);
  }
  root.append(links, dots);
  return root;
}
