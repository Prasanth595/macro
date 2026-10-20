import ArrowLeft from '@phosphor/arrow-left.svg';
import Check from '@phosphor/check.svg';
import Plus from '@phosphor/plus.svg';
import Tray from '@phosphor/tray.svg';
import { Button, Dropdown } from '@ui';
import { createSignal, For, Show } from 'solid-js';
import {
  type DemoEmail,
  demoMailAccounts,
  type EmailTagId,
  emailTags,
} from '../../core/demo-email';
import { emailPageInbox } from '../../core/email-demo-story';
import { createEmailWalkthrough } from '../../primitives/createEmailWalkthrough';
import HomepageEmailCompose from '../HomepageEmailCompose';
import { EmailRows } from './frozen/EmailRows';
import {
  EmailShell,
  EmailSidebar,
  type MailTab,
  mailTabs,
} from './frozen/EmailShell';
import { EmailThread } from './frozen/EmailThread';
import { SearchBar } from './frozen/SearchBar';
import './email-feature-demos.css';
import './email-accounts-demo.css';

/** EmailInboxList/EmailInboxMenu presentation with local sample accounts only. */
export function EmailAccountsDemo() {
  let root!: HTMLDivElement;
  const [accountCount, setAccountCount] = createSignal(1);
  const [account, setAccount] = createSignal('work');
  const [tab, setTab] = createSignal<MailTab>('important');
  const [tag, setTag] = createSignal<EmailTagId>();
  const [query, setQuery] = createSignal('');
  const [selected, setSelected] = createSignal<DemoEmail>();
  const [compose, setCompose] = createSignal(false);
  const [step, setStep] = createSignal(0);
  const accounts = () => demoMailAccounts.slice(0, accountCount());
  const accountLabel = () =>
    demoMailAccounts.find((a) => a.id === account())?.label ?? 'All inboxes';
  const title = () =>
    emailTags.find((t) => t.id === tag())?.label ??
    mailTabs.find((t) => t.id === tab())?.label;
  const emails = () =>
    emailPageInbox.filter(
      (email) =>
        accounts().some((account) => account.id === email.account) &&
        (account() === 'all' || email.account === account()) &&
        (!tag() || email.tags?.includes(tag()!)) &&
        (tab() === 'all' ||
          (tab() === 'important' && !email.noise) ||
          (tab() === 'noise' && email.noise) ||
          (tab() === 'favorites' && email.favorite)) &&
        `${email.sender} ${email.subject} ${email.snippet}`
          .toLowerCase()
          .includes(query().toLowerCase())
    );
  const finish = () => {
    setAccountCount(3);
    setAccount('all');
    setTab('important');
    setStep(7);
  };
  const playback = createEmailWalkthrough({
    root: () => root,
    steps: 7,
    visibilityThreshold: 0.45,
    delay: (step) => [1500, 900, 1400, 900, 1600, 2000, 1800][step - 1],
    reset: () => {
      setAccountCount(1);
      setAccount('work');
      setTab('important');
      setStep(0);
    },
    reduced: finish,
    advance: (next) => {
      setStep(next);
      if (next === 2) setAccountCount(2);
      if (next === 4) setAccountCount(3);
      if (next === 5 || next === 7) setAccount('all');
      if (next === 6) setAccount('personal');
    },
  });
  const chooseAccount = (id: string) => {
    playback.pause();
    setAccount(id);
    setSelected(undefined);
    setCompose(false);
  };
  const chooseTab = (id: MailTab) => {
    playback.pause();
    setTab(id);
    setTag(undefined);
    setSelected(undefined);
    setCompose(false);
  };
  const connect = () => {
    playback.pause();
    setAccountCount((count) => Math.min(count + 1, 3));
    setAccount('all');
    setStep(7);
  };
  return (
    <div
      ref={root}
      class="email-feature-demo email-accounts-demo"
      data-step={step()}
      onPointerDown={playback.pause}
      onFocusIn={playback.pause}
    >
      <EmailShell
        showRail={false}
        label="Try multiple email accounts"
        sidebar={
          <EmailSidebar
            account={account()}
            accounts={accounts()}
            onAccount={chooseAccount}
            onConnect={accountCount() < 3 ? connect : undefined}
            connecting={step() === 1 || step() === 3}
            tab={tab()}
            onTab={chooseTab}
            tag={tag()}
            onTag={(id) => {
              chooseTab('all');
              setAccount('all');
              setTag(id);
            }}
            onCompose={() => {
              playback.pause();
              setCompose(true);
            }}
          />
        }
      >
        <header class="email-feature-toolbar email-accounts-toolbar">
          <Show when={selected() || compose()}>
            <Button
              variant="plain"
              size="icon-sm"
              aria-label="Back to inbox"
              onClick={() => {
                setSelected(undefined);
                setCompose(false);
              }}
            >
              <ArrowLeft />
            </Button>
          </Show>
          <span>
            {compose() ? 'New email' : (selected()?.subject ?? title())}
          </span>
          <Show when={account() !== 'all' && !selected() && !compose()}>
            <span class="email-account-scope">from {accountLabel()}</span>
          </Show>
          <div class="email-accounts-mobile">
            <Dropdown placement="bottom-end">
              <Dropdown.Trigger
                variant="ghost"
                size="icon-sm"
                aria-label={`Inbox: ${accountLabel()}`}
              >
                <Tray />
              </Dropdown.Trigger>
              <Dropdown.Content>
                <Dropdown.RadioGroup value={account()} onChange={chooseAccount}>
                  <Dropdown.RadioItem value="all" closeOnSelect>
                    All inboxes
                  </Dropdown.RadioItem>
                  <For each={accounts()}>
                    {(a) => (
                      <Dropdown.RadioItem value={a.id} closeOnSelect>
                        {a.label}
                      </Dropdown.RadioItem>
                    )}
                  </For>
                </Dropdown.RadioGroup>
                <Show when={accountCount() < 3}>
                  <Dropdown.Item onSelect={connect} closeOnSelect>
                    <Plus />
                    Connect another account
                  </Dropdown.Item>
                </Show>
              </Dropdown.Content>
            </Dropdown>
          </div>
        </header>
        <Show
          when={!compose()}
          fallback={
            <div class="email-account-compose">
              <HomepageEmailCompose
                appChrome
                draft={{ subject: '', to: '', cc: '', body: '' }}
              />
            </div>
          }
        >
          <Show
            when={selected()}
            fallback={
              <>
                <nav
                  class="email-account-mobile-tabs"
                  aria-label="Mobile email tabs"
                >
                  <For
                    each={mailTabs.filter((t) =>
                      ['important', 'noise', 'all'].includes(t.id)
                    )}
                  >
                    {(t) => (
                      <button
                        type="button"
                        aria-pressed={tab() === t.id}
                        onClick={() => chooseTab(t.id)}
                      >
                        <t.icon />
                        {t.label}
                      </button>
                    )}
                  </For>
                </nav>
                <div class="email-account-search">
                  <SearchBar
                    label="Search across inboxes"
                    placeholder="Search email"
                    hotkey="cmd+f"
                    value={query()}
                    onValueChange={(value) => {
                      playback.pause();
                      setQuery(value);
                    }}
                  />
                </div>
                <div class="email-account-list">
                  <EmailRows
                    emails={emails()}
                    onOpen={(email) => {
                      playback.pause();
                      setSelected(email);
                    }}
                  />
                </div>
              </>
            }
          >
            {(email) => (
              <div class="email-account-thread">
                <EmailThread email={email()} hideHeader hideReply />
              </div>
            )}
          </Show>
        </Show>
        <Show when={(step() === 2 || step() === 4) && playback.playing()}>
          <div class="email-account-connected" role="status">
            <Check />
            Account connected
          </div>
        </Show>
      </EmailShell>
    </div>
  );
}
