const CHARS_PER_STEP = 2;
const STEP_MS = 14;

// Typed-out log. Lines queue up and type faster when the queue backs up, so the
// log never falls behind the game.
export class Terminal {
  constructor(element, { maxLines = 5 } = {}) {
    this.element = element;
    this.maxLines = maxLines;
    this.queue = [];
    this.timeoutId = null;
    this.instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // kind: cmd | system | hint | ok | warn | error | input
  print(kind, text) {
    this.queue.push({ kind, text });
    if (this.timeoutId === null) this.typeNext();
  }

  clear() {
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.queue = [];
    this.element.replaceChildren();
  }

  typeNext() {
    const line = this.queue.shift();
    if (!line) return;

    const row = document.createElement('p');
    row.className = `log log-${line.kind}`;
    this.element.append(row);
    while (this.element.childElementCount > this.maxLines) this.element.firstChild.remove();

    let shown = 0;
    const step = () => {
      shown = this.instant ? line.text.length : shown + CHARS_PER_STEP + this.queue.length * 3;
      row.textContent = line.text.slice(0, shown);
      if (shown < line.text.length) {
        this.timeoutId = setTimeout(step, STEP_MS);
      } else {
        this.timeoutId = null;
        this.typeNext();
      }
    };
    step();
  }
}
