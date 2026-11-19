import type { ChatTurn } from '../adapter/seam.ts';
import type { Engine } from '../shell/activity-feed.ts';
import { engineFocusChannel } from '../shell/engine-focus-channel.ts';
import { playClick } from '../shell/click.ts';

/**
 * The engine boxes beside a reply: KTIE, ERIE, ELLE, top to bottom. A box
 * is lit (its engine colour) when that engine worked the turn, dark
 * otherwise; it is a button either way. Clicking one shows that engine's
 * events for this turn in the telemetry column (engineFocusChannel);
 * clicking the box already shown goes back to the general feed.
 */

export const ENGINES: readonly Engine[] = ['KATIE', 'ERIE', 'ELLE'];

/** The four-letter name each box (and the detail heading) shows. */
export const BOX_LABEL: Record<Engine, string> = { KATIE: 'KTIE', ERIE: 'ERIE', ELLE: 'ELLE' };

/** Did `engine` work this turn? Read from the turn's own engine activity. */
export function engineLit(turn: ChatTurn, engine: Engine): boolean {
  const e = turn.engines;
  if (engine === 'KATIE') return e.katie.length > 0; // the seam's rule: empty = did not act
  if (engine === 'ERIE') return e.erie !== null; // found and not_found both: ERIE looked
  return (
    e.lessons_in_prompt.injected.length > 0 ||
    e.lessons_in_prompt.held.length > 0 ||
    e.elle !== null ||
    e.elle_promoted !== null
  );
}

/** Mark the pressed box (if any) among `root`'s engine boxes. */
export function syncEngineBoxes(root: ParentNode): void {
  const f = engineFocusChannel.current();
  for (const b of root.querySelectorAll<HTMLButtonElement>('.engine-box')) {
    const on = f !== null && b.dataset.engine === f.engine && b.dataset.turn === String(f.turnIndex);
    b.setAttribute('aria-pressed', String(on));
  }
}

export function renderEngineBoxes(turn: ChatTurn, turnIndex: number): HTMLElement {
  const col = document.createElement('div');
  col.className = 'engine-boxes';
  col.setAttribute('role', 'group');
  col.setAttribute('aria-label', 'Engines on this turn');
  for (const engine of ENGINES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'engine-box';
    b.dataset.engine = engine;
    b.dataset.turn = String(turnIndex);
    b.dataset.lit = String(engineLit(turn, engine));
    b.textContent = BOX_LABEL[engine];
    b.setAttribute('aria-label', `Show ${BOX_LABEL[engine]} detail for this turn`);
    // Lit or dark is more than a colour: say it to screen readers and on hover.
    const said = engineLit(turn, engine) ? 'Worked this turn' : 'Sat this turn out';
    b.setAttribute('aria-description', said);
    b.title = `${BOX_LABEL[engine]}: ${said.toLowerCase()}`;
    b.addEventListener('click', () => {
      playClick();
      const f = engineFocusChannel.current();
      const isOn = f !== null && f.engine === engine && f.turnIndex === turnIndex;
      engineFocusChannel.publish(isOn ? null : { engine, turnIndex });
    });
    col.appendChild(b);
  }
  syncEngineBoxes(col);
  return col;
}
