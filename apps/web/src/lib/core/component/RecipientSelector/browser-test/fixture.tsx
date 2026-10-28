import '@app/index.css';
import {
  attachGlobalDOMScope,
  registerHotkey,
  useHotKeyRoot,
  useHotkeyDOMScope,
} from '@core/hotkey/hotkeys';
import { Dialog } from '@kobalte/core/dialog';
import {
  Button,
  Dropdown,
  ImperativeDialogHost,
  type ManagedDialogProps,
  openDialog,
  Panel,
} from '@ui';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { RecipientSelector } from '../../RecipientSelector';

function ShareDialog(props: ManagedDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="z-modal fixed inset-0 scrim-glass" />
        <div class="z-modal fixed inset-0">
          <Dialog.Content
            class="portal-scope isolate mx-auto mt-40 max-w-[calc(100vw-16px)]"
            style={{ width: '800px' }}
          >
            <Panel
              depth={2}
              hideBorder
              class="elevated-surface rounded-[24px] bg-dialog"
            >
              <Panel.Header class="px-4">
                <Dialog.Title>Share: Launch tasks</Dialog.Title>
              </Panel.Header>
              <div class="p-4 flex items-center gap-2">
                <RecipientSelector
                  options={() => []}
                  selectedOptions={[]}
                  setSelectedOptions={() => {}}
                  focusOnMount
                  portalScope="local"
                  inviteExternalEmails
                  placeholder="To: Email or group"
                />
                <Dropdown>
                  <Dropdown.Trigger>Can view</Dropdown.Trigger>
                  <Dropdown.Content portalScope="local">
                    <Dropdown.Item>Can edit</Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown>
              </div>
              <Button onClick={() => props.onOpenChange(false)}>Done</Button>
            </Panel>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

function Fixture() {
  attachGlobalDOMScope(document.body);
  useHotKeyRoot();
  const [attachScope, scope] = useHotkeyDOMScope('database');
  const [escapes, setEscapes] = createSignal(0);
  registerHotkey({
    scopeId: scope,
    hotkey: 'escape',
    description: 'Leave database',
    runWithInputFocused: true,
    keyDownHandler: () => {
      setEscapes(escapes() + 1);
      return true;
    },
  });
  return (
    <main class="h-screen bg-page text-ink p-8">
      <section ref={attachScope}>
        <header class="flex items-center justify-between border-b border-edge pb-4">
          <h1>Launch tasks</h1>
          <Button onClick={() => openDialog(ShareDialog, {})}>Share</Button>
        </header>
        <p class="mt-6">Database sharing keyboard regression</p>
        <output aria-label="Database Escape handlers">{escapes()}</output>
      </section>
      <ImperativeDialogHost />
    </main>
  );
}
render(() => <Fixture />, document.getElementById('root')!);
