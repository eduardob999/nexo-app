/**
 * When Suggestions mode asks for a review by itself. Same rule as the autosave: nothing happens while a composition
 * is open, because the kana still being converted are not text yet. After the text has been still for `delay`, and
 * no review is already running, and there is a finished sentence he has not had reviewed, it fires once.
 * The helper reviews each sentence only once, so a repeat costs nothing; this class just avoids asking for nothing.
 */
import type { Timers } from './autosave';

const REAL: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };
const ENDS = /[.!?。！？]\s*$|\n\s*$/;
const HAS_SENTENCE = /[.!?。！？]/;

export class AutoReview {
  private composing = false;
  private busy = false;
  private text: string;
  private asked: string;
  private pending: unknown = null;

  constructor(initial: string, private readonly fire: (text: string) => void, private readonly delay = 2500, private readonly timers: Timers = REAL) {
    this.text = initial;
    this.asked = initial;
  }

  private cancel() { if (this.pending !== null) { this.timers.clear(this.pending); this.pending = null; } }
  private schedule() {
    this.cancel();
    this.pending = this.timers.set(() => { this.pending = null; this.maybe(); }, this.delay);
  }
  private maybe() {
    if (this.composing || this.busy) return;
    const t = this.text;
    if (t === this.asked || t.trim().length < 15 || !HAS_SENTENCE.test(t)) return;
    this.asked = t;
    this.fire(t);
  }

  /** `isComposing` is the native input event's flag; Android keyboards do not always fire compositionstart. */
  change(text: string, isComposing = false) {
    this.text = text;
    if (isComposing) this.composing = true;
    if (!this.composing) this.schedule();
  }
  compositionStart() { this.composing = true; this.cancel(); }
  compositionEnd(text: string) { this.composing = false; this.text = text; this.schedule(); }
  /** A review is running (or finished): never start another on top of it, and look again once it is over. */
  setBusy(busy: boolean) { const was = this.busy; this.busy = busy; if (was && !busy && !this.composing) this.schedule(); }
  /** Text that arrived from elsewhere is not his typing and is not reviewed until he changes it. */
  adopt(text: string) { this.cancel(); this.text = text; this.asked = text; this.composing = false; }
  dispose() { this.cancel(); }

  /** Exposed for the test: does this text end a sentence. */
  static endsSentence(text: string) { return ENDS.test(text); }
}
