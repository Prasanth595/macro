import { LIST_VIEW_ID } from '@app/constants/list-views';

import ArrowLeft from '@phosphor/arrow-left.svg';
import ArrowRight from '@phosphor/arrow-right.svg';
import SplitIcon from '@phosphor/square-half.svg';
import CloseIcon from '@phosphor/x.svg';
import { Button } from '@ui';
import { useContext } from 'solid-js';
import { SplitLayoutContext, SplitPanelContext } from './context';

export function SplitBackButton() {
  const context = useContext(SplitPanelContext);
  if (!context) return '';
  return (
    <Button aria-label={"Go Back"} tooltip={"Go Back"}
      variant="ghost"
      size="icon-md"
      
      disabled={!context.handle.canGoBack()}
      onClick={context.handle.goBack}
    >
      <ArrowLeft class="size-4 touch:size-6 shrink-0 pointer-events-none" />
    </Button>
  );
}

export function SplitForwardButton() {
  const context = useContext(SplitPanelContext);
  if (!context) return '';
  return (
    <Button aria-label={"Go Forward"} tooltip={"Go Forward"}
      variant="ghost"
      size="icon-md"
      
      disabled={!context.handle.canGoForward()}
      onClick={context.handle.goForward}
    >
      <ArrowRight class="size-4 touch:size-6 shrink-0 pointer-events-none" />
    </Button>
  );
}

export function SplitCreateButton() {
  const context = useContext(SplitLayoutContext);
  if (!context) return '';
  return (
    <Button aria-label={"Create new split"} tooltip={"Create new split"}
      variant="ghost"
      size="icon-md"
      
      onClick={() => {
        context.manager.createNewSplit({
          content: {
            type: 'component',
            id: LIST_VIEW_ID.home,
          },
          referredFrom: 'dock',
        });
      }}
    >
      <SplitIcon class="size-4 touch:size-6 shrink-0 pointer-events-none" />
    </Button>
  );
}

export function SplitCloseButton() {
  const context = useContext(SplitPanelContext);
  if (!context) return '';
  return (
    <Button aria-label={"Close"} tooltip={"Close"}
      variant="ghost"
      size="icon-sm"
      
      onClick={context.handle.close}
    >
      <CloseIcon class="size-3.5 touch:size-6 shrink-0 pointer-events-none" />
    </Button>
  );
}
