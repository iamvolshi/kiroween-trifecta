/**
 * The light tiny click a pressed engine box makes. Synthesised with Web
 * Audio — no audio file, no dependency, one shared context. Silent when the
 * browser has no AudioContext (jsdom, old browsers): the boxes work without
 * sound, and a box that cannot click still works.
 */

let ctx: AudioContext | null = null;

export function playClick(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof AC !== 'function') return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  } catch {
    // Sound is garnish: never let it break a press.
  }
}
