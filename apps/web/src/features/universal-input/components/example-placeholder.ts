import { type Accessor, createSignal, onCleanup } from 'solid-js';

/** Cycle examples by deleting and typing their suffix; the caller owns the prefix. */
export function createExamplePlaceholder(
  examples: readonly string[],
  enabled: Accessor<boolean>
) {
  const [text, setText] = createSignal(examples[0] ?? '');
  let index = 0;
  let deleting = true;
  let timer: ReturnType<typeof setTimeout>;

  const tick = () => {
    if (!enabled() || examples.length < 2) {
      timer = setTimeout(tick, 500);
      return;
    }
    if (deleting) {
      setText((value) => value.slice(0, -1));
      if (!text()) {
        index = (index + 1) % examples.length;
        deleting = false;
      }
      timer = setTimeout(tick, deleting ? 12 : 120);
      return;
    }
    const example = examples[index];
    setText(example.slice(0, text().length + 1));
    if (text() === example) {
      deleting = true;
      timer = setTimeout(tick, 4200);
    } else timer = setTimeout(tick, 22);
  };
  timer = setTimeout(tick, 4200);
  onCleanup(() => clearTimeout(timer));
  return text;
}
