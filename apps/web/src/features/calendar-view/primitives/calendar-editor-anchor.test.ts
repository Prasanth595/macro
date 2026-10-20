import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarSelectionAnchor } from './calendar-editor-anchor';

function selectAt(target: Element, x: number, y: number) {
  const jsEvent = new MouseEvent('mouseup', {
    bubbles: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(jsEvent);
  return calendarSelectionAnchor({ jsEvent });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('calendar editor selection anchor', () => {
  it('captures the selected preview under the pointer rather than another day', () => {
    document.body.innerHTML = `
      <div class="fc">
        <div data-date="2030-10-21">
          <div class="fc-highlight"></div>
        </div>
        <div data-date="2030-10-22">
          <div class="fc-highlight"></div>
        </div>
      </div>`;
    const previews = document.querySelectorAll('.fc-highlight');
    vi.spyOn(previews[0], 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 200, 80, 120)
    );
    const selected = new DOMRect(200, 200, 80, 120);
    vi.spyOn(previews[1], 'getBoundingClientRect').mockReturnValue(selected);

    const anchor = selectAt(previews[1], 220, 300);
    expect(anchor?.rect).toBe(selected);
    expect(anchor?.element).toBe(previews[1]);
    previews[1].remove();
    expect(selected.toJSON()).toMatchObject({
      x: 200,
      y: 200,
      width: 80,
      height: 120,
    });
  });

  it('uses the clicked day width when a selection preview is not rendered yet', () => {
    const day = document.createElement('div');
    day.dataset.date = '2030-10-21';
    document.body.append(day);
    vi.spyOn(day, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 150, 120, 600)
    );
    expect(selectAt(day, 160, 220)?.rect.toJSON()).toMatchObject({
      x: 100,
      y: 220,
      width: 120,
      height: 0,
    });
  });

  it('uses the pointer position when no day element is available', () => {
    const target = document.createElement('div');
    document.body.append(target);
    expect(selectAt(target, 420, 300)?.rect.toJSON()).toMatchObject({
      x: 420,
      y: 300,
      width: 0,
      height: 0,
    });
  });

  it('does not invent an anchor for programmatic selections', () => {
    expect(calendarSelectionAnchor({ jsEvent: null })).toBeUndefined();
  });
});
