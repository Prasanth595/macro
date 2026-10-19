import { For, type JSX, lazy, onCleanup, onMount, Show } from 'solid-js';
import siteStyles from '../../../app/main/index.css?inline';
import { DeferredDemo, DemoPlaceholder } from './DeferredDemo';
import { DemoMention } from './DemoMention';
import { HomepageAgentLogos } from './HomepageAgentLogos';
import { HomepageBlog } from './HomepageBlog';
import { HomepageClosing } from './HomepageClosing';
import { HomepageConversation } from './HomepageConversation';
import { HomepageMention } from './HomepageMention';
import { HomepageOpenSource } from './HomepageOpenSource';
import { HomepageSidebar } from './HomepageSidebar';
import { HomepageTestimonials } from './HomepageTestimonials';
import './workspace-story.css';
import './homepage-feature-sections.css';

// Retain the standalone sidebar breakdown for future use.
const SHOW_SIDEBAR_BREAKDOWN = false;

const loadPullRequest = () => import('./HomepagePullRequest');
const loadEmailCompose = () => import('./HomepageEmailCompose');
const loadCollaborativeDoc = () => import('./HomepageCollaborativeDoc');
const loadCrm = () => import('./HomepageCrm');
const HomepageCrm = lazy(loadCrm);
const loadSpreadsheet = () => import('./HomepageSpreadsheet');

const HomepagePullRequest = lazy(loadPullRequest);
const HomepageEmailCompose = lazy(loadEmailCompose);
const HomepageCollaborativeDoc = lazy(loadCollaborativeDoc);
const HomepageSpreadsheet = lazy(loadSpreadsheet);

const definitions =
  siteStyles.match(/@(font-face|property)[^{]*\{[^}]*\}/g)?.join('\n') ?? '';
const scopedStyles = siteStyles
  .replace(/@(font-face|property)[^{]*\{[^}]*\}/g, '')
  .replaceAll(':root', ':scope');

function Feature(props: {
  id: string;
  category: string;
  title: string;
  description: string;
  details: readonly { title: string; text: string }[];
  titleAdornment?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section
      class="homepage-feature"
      aria-labelledby={`${props.id}-title`}
      id={props.id}
    >
      <header class="homepage-feature-intro workspace-demo homepage-enter">
        <div>
          <p class="homepage-feature-category">{props.category}</p>
          <h2 id={`${props.id}-title`}>{props.title}</h2>
          <Show when={props.titleAdornment}>
            <div class="homepage-feature-adornment">{props.titleAdornment}</div>
          </Show>
        </div>
        <div class="homepage-feature-summary">
          <p>{props.description}</p>
        </div>
      </header>
      <div class="homepage-feature-visual">
        <div
          class={`homepage-feature-graphic homepage-enter homepage-feature-${props.id}`}
        >
          {props.children}
        </div>
      </div>
      <div class="homepage-feature-details workspace-demo">
        <p>What you can do</p>
        <div class="homepage-feature-detail-grid">
          <For each={props.details}>
            {(detail) => (
              <details>
                <summary>
                  {detail.title}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{detail.text}</p>
              </details>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}

export function HomepageSections() {
  let root!: HTMLDivElement;

  onMount(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('.homepage-enter')
    );
    // Observe visibility only: no scroll listeners, pinned content, or layout
    // changes. Each message arrives once, and stays readable when scrolling back.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'visible';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -32px 0px', threshold: 0.08 }
    );
    const showAll = () => {
      if (!reduced.matches) return;
      observer.disconnect();
      items.forEach((item) => {
        item.dataset.reveal = 'visible';
      });
    };
    for (const item of items) {
      item.dataset.reveal = reduced.matches ? 'visible' : 'waiting';
      if (!reduced.matches) observer.observe(item);
    }
    // Keyboard navigation must never land in a faded, pending example.
    const showFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const item = event.target.closest<HTMLElement>('.homepage-enter');
      if (item) {
        item.dataset.reveal = 'visible';
        observer.unobserve(item);
      }
    };
    root.addEventListener('focusin', showFocused);
    reduced.addEventListener('change', showAll);
    onCleanup(() => {
      observer.disconnect();
      root.removeEventListener('focusin', showFocused);
      reduced.removeEventListener('change', showAll);
    });
  });

  return (
    <div ref={root} class="homepage-sections">
      <style>{definitions}</style>
      <style>{`@scope (.homepage-sections) to (.workspace-demo) { ${scopedStyles} }`}</style>
      <div class="homepage-sections-inner">
        <HomepageOpenSource showSidebarBreakdown={SHOW_SIDEBAR_BREAKDOWN}>
          <HomepageSidebar showInteractiveDemo={false} />
        </HomepageOpenSource>
        <Feature
          id="email"
          category="Email and chat"
          title={'From chat\nto email draft.'}
          description="Discuss an email with your team, then ask Macro to draft the reply using the calls and documents already in your workspace."
          details={[
            {
              title: 'Share an email in chat',
              text: 'Bring the live thread into a channel so your team can read the context and help with the reply.',
            },
            {
              title: 'Draft from your work',
              text: 'Ask Macro to use a call, document, or conversation when writing a follow-up.',
            },
            {
              title: 'Keep replies together',
              text: 'Discuss the details in a thread instead of losing them in the channel.',
            },
            {
              title: 'Find the context',
              text: 'Follow a mention to the email, document, or task behind the conversation.',
            },
          ]}
        >
          <div class="homepage-email-story">
            <HomepageConversation
              messages={[
                {
                  person: 'julia',
                  text: 'Can you send Valentina the demo follow-up?',
                },
                {
                  person: 'jacob',
                  text: (
                    <>
                      <DemoMention
                        item={{ id: 'macro', label: 'Macro', kind: 'person' }}
                      />{' '}
                      draft Valentina’s follow-up from{' '}
                      <HomepageMention
                        kind="call"
                        label="Demo call transcript"
                        description="The customer call, including rollout questions and next steps."
                        href="#email"
                      />
                      . Link the sales PDF and rollout plan. Cc Julia.
                    </>
                  ),
                },
              ]}
            />
            <div class="homepage-email-story-draft">
              <DeferredDemo
                preload={loadEmailCompose}
                fallback={<DemoPlaceholder label="Email draft preview" />}
              >
                <HomepageEmailCompose />
              </DeferredDemo>
            </div>
          </div>
        </Feature>
        <Feature
          id="documents"
          category="Documents and tasks"
          title="Make the plan. Move it forward."
          description="Write together, turn decisions into tasks, and keep every next step connected to the plan. Your team and your agents work in the same document."
          details={[
            {
              title: 'Write together',
              text: 'See edits from teammates and agents as they happen, without passing copies around.',
            },
            {
              title: 'Turn decisions into tasks',
              text: 'Create a task from the conversation and link it to the document that explains the work.',
            },
            {
              title: 'Keep track of changes',
              text: 'Follow the document’s history to see how the plan evolved.',
            },
            {
              title: 'Give every task an owner',
              text: 'Set an assignee, priority, and status so everyone knows what happens next.',
            },
          ]}
        >
          <figure class="homepage-doc-history" id="tasks">
            <div id="version-control">
              <DeferredDemo
                preload={loadCollaborativeDoc}
                fallback={
                  <DemoPlaceholder label="Collaborative document, tasks, and version history preview" />
                }
              >
                <HomepageCollaborativeDoc />
              </DeferredDemo>
            </div>
          </figure>
        </Feature>
        <Feature
          id="coding-agents"
          category="Coding agents"
          title="Bring your agents into the team."
          titleAdornment={<HomepageAgentLogos />}
          description="Ask an agent to pick up a task, follow its progress, and review the changes together. Use the coding subscriptions you already have."
          details={[
            {
              title: 'Start from a conversation',
              text: 'Give an agent the task where your team is already discussing it.',
            },
            {
              title: 'Follow the work',
              text: 'Open the session to see the agent’s progress and the tools it used.',
            },
            {
              title: 'Review the changes',
              text: 'Read the diff and discuss it before the work is merged.',
            },
            {
              title: 'Keep the result connected',
              text: 'Follow the pull request back to the task and conversation that started it.',
            },
          ]}
        >
          <DeferredDemo
            preload={loadPullRequest}
            fallback={<DemoPlaceholder label="Agent session preview" />}
          >
            <HomepagePullRequest />
          </DeferredDemo>
        </Feature>
        <Feature
          id="spreadsheet"
          category="Sheets and databases"
          title="Turn shared data into the next step."
          description="Work together in spreadsheets and databases. Ask an agent to find what matters and build a list your team can act on."
          details={[
            {
              title: 'Work in the same sheet',
              text: 'Keep the team’s data in one place and collaborate as it changes.',
            },
            {
              title: 'Bring your data along',
              text: 'Import existing spreadsheets and databases instead of starting from scratch.',
            },
            {
              title: 'Ask an agent to help',
              text: 'Have an agent gather information and update the sheet alongside your team.',
            },
            {
              title: 'Connect data to the work',
              text: 'Link the list to the conversations, customers, and tasks it supports.',
            },
          ]}
        >
          <DeferredDemo
            preload={loadSpreadsheet}
            fallback={<DemoPlaceholder label="Spreadsheet preview" />}
          >
            <HomepageSpreadsheet />
          </DeferredDemo>
        </Feature>
        <Feature
          id="crm"
          category="CRM"
          title="Keep the whole customer story."
          description="See the conversations, calls, documents, and next steps behind each deal. Keep the pipeline current from the work you’re already doing."
          details={[
            {
              title: 'Start with your email',
              text: 'Companies and contacts are created from the people your team emails.',
            },
            {
              title: 'See the full relationship',
              text: 'Open a company to find its conversations, calls, files, and team discussion.',
            },
            {
              title: 'Keep the pipeline current',
              text: 'Move deals through stages yourself or ask an agent to update them from a sales conversation.',
            },
            {
              title: 'Follow up with context',
              text: 'Draft the next message using the call notes and documents already linked to the customer.',
            },
          ]}
        >
          <DeferredDemo
            preload={loadCrm}
            fallback={<DemoPlaceholder label="CRM pipeline preview" />}
          >
            <HomepageCrm />
          </DeferredDemo>
        </Feature>
        <HomepageTestimonials />
        <HomepageBlog />
        <HomepageClosing root={() => root} />
      </div>
    </div>
  );
}
