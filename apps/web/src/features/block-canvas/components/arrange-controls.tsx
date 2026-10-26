import type { Alignment } from '@macro-inc/graphics';
import AlignBottom from '@phosphor/align-bottom-simple.svg';
import AlignCenter from '@phosphor/align-center-horizontal-simple.svg';
import AlignMiddle from '@phosphor/align-center-vertical-simple.svg';
import AlignLeft from '@phosphor/align-left-simple.svg';
import AlignRight from '@phosphor/align-right-simple.svg';
import AlignTop from '@phosphor/align-top-simple.svg';
import ArrowsHorizontal from '@phosphor/arrows-horizontal.svg';
import ArrowsVertical from '@phosphor/arrows-vertical.svg';
import { ButtonGroup } from '@ui';
import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

export function CanvasAlignmentControls(props: {
  count: number;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
}) {
  return (
    <div class="space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <For
          each={
            [
              [
                ['left', AlignLeft],
                ['center', AlignCenter],
                ['right', AlignRight],
              ],
              [
                ['top', AlignTop],
                ['middle', AlignMiddle],
                ['bottom', AlignBottom],
              ],
            ] as const
          }
        >
          {(alignments) => (
            <ButtonGroup finish="raised" variant="secondary"
              size="icon-sm"
              class="w-full data-[orientation=horizontal]:rounded-lg"
            >
              <For each={alignments}>
                {([alignment, icon]) => (
                  <>
                    <ButtonGroup.Button aria-label={`Align ${alignment}`} tooltip={`Align ${alignment}`}
                      fullWidth
                      
                      
                      disabled={props.count < 2}
                      onClick={() => props.onAlign(alignment)}
                    >
                      <Dynamic component={icon} />
                    </ButtonGroup.Button>
                  </>
                )}
              </For>
            </ButtonGroup>
          )}
        </For>
      </div>
      <Show when={props.count >= 3}>
        <ButtonGroup finish="raised" variant="secondary"
          size="icon-sm"
          class="data-[orientation=horizontal]:rounded-lg"
        >
          <ButtonGroup.Button aria-label={"Distribute horizontal"} tooltip={"Distribute horizontal"}
            
            disabled={props.count < 3}
            onClick={() => props.onDistribute('horizontal')}
          >
            <ArrowsHorizontal class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
          </ButtonGroup.Button>
          <ButtonGroup.Button aria-label={"Distribute vertical"} tooltip={"Distribute vertical"}
            
            disabled={props.count < 3}
            onClick={() => props.onDistribute('vertical')}
          >
            <ArrowsVertical class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
          </ButtonGroup.Button>
        </ButtonGroup>
      </Show>
    </div>
  );
}
