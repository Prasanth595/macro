import { type JSX, lazy, onCleanup, onMount, Show } from 'solid-js';
import siteStyles from '../../../app/main/index.css?inline';
import {
  type HomepageFeatureDetail,
  homepageFeatureDetails,
} from '../core/homepage-feature-details';
import { DeferredDemo, DemoPlaceholder } from './DeferredDemo';
import './homepage-demo-surfaces.css';
import { HomepageAgentLogos } from './HomepageAgentLogos';
import { HomepageBlog } from './HomepageBlog';
import { HomepageClosing } from './HomepageClosing';
import { HomepageFeatureDetails } from './HomepageFeatureDetails';
import { HomepageOpenSource } from './HomepageOpenSource';
import { HomepageSidebar } from './HomepageSidebar';
import { HomepageTestimonials } from './HomepageTestimonials';
import './workspace-story.css';
import './homepage-feature-sections.css';

// Retain the standalone sidebar breakdown for future use.
const SHOW_SIDEBAR_BREAKDOWN = false;

const loadAgentTeamwork = async () => ({
  default: (await import('./agents/AgentWorkflowStories')).AgentTeamworkStory,
});
const loadEmailStory = async () => ({
  default: (await import('./HomepageEmailStory')).HomepageEmailStory,
});
const HomepageEmailStory = lazy(loadEmailStory);
const loadDocumentProject = async () => ({
  default: (await import('./documents/DocumentProjectDemo'))
    .DocumentProjectDemo,
});
const loadCrmRecord = async () => {
  await import('./crm/crm-page.css');
  return { default: (await import('./crm/CrmRecordDemo')).CrmRecordDemo };
};
const CrmRecordDemo = lazy(loadCrmRecord);
const loadSpreadsheet = () => import('./HomepageSpreadsheet');

const AgentTeamworkStory = lazy(loadAgentTeamwork);
const DocumentProjectDemo = lazy(loadDocumentProject);
const HomepageSpreadsheet = lazy(loadSpreadsheet);

const definitions =
  siteStyles.match(/@(font-face|property)[^{]*\{[^}]*\}/g)?.join('\n') ?? '';
const scopedStyles = siteStyles
  .replace(/@(font-face|property)[^{]*\{[^}]*\}/g, '')
  .replaceAll(':root', ':scope');

function Feature(props: {
  id: string;
  title: string;
  description: string;
  group: string;
  details: readonly HomepageFeatureDetail[];
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
          class={`homepage-feature-graphic homepage-native-demo homepage-enter homepage-feature-${props.id}`}
        >
          {props.children}
        </div>
      </div>
      <HomepageFeatureDetails group={props.group} details={props.details} />
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
          title={'From chat\nto email draft.'}
          description="Discuss an email with your team, then ask Macro to draft the reply using the calls and documents already in your workspace."
          group="Email and chat"
          details={homepageFeatureDetails.email}
        >
          <DeferredDemo
            preload={loadEmailStory}
            fallback={
              <DemoPlaceholder label="Channel and email draft preview" />
            }
          >
            <HomepageEmailStory />
          </DeferredDemo>
        </Feature>
        <Feature
          id="documents"
          title="Make the plan. Move it forward."
          description="Write together, turn decisions into tasks, and keep every next step connected to the plan. Your team and your agents work in the same document."
          group="Documents and tasks"
          details={homepageFeatureDetails.documents}
        >
          <figure class="homepage-doc-history" id="tasks">
            <div id="version-control">
              <DeferredDemo
                preload={loadDocumentProject}
                fallback={
                  <DemoPlaceholder label="Collaborative document and linked tasks preview" />
                }
              >
                <DocumentProjectDemo />
              </DeferredDemo>
            </div>
          </figure>
        </Feature>
        <Feature
          id="coding-agents"
          title="Bring your agents into the team."
          titleAdornment={<HomepageAgentLogos />}
          description="Ask an agent to pick up a task, follow its progress, and review the changes together. Use the coding subscriptions you already have."
          group="Coding agents"
          details={homepageFeatureDetails.agents}
        >
          <DeferredDemo
            preload={loadAgentTeamwork}
            fallback={<DemoPlaceholder label="Agent session preview" />}
          >
            <AgentTeamworkStory />
          </DeferredDemo>
        </Feature>
        <Feature
          id="spreadsheet"
          title="Turn shared data into the next step."
          description="Work together in spreadsheets and databases. Ask an agent to find what matters and build a list your team can act on."
          group="Sheets and databases"
          details={homepageFeatureDetails.spreadsheet}
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
          title="Keep the whole customer story."
          description="See the conversations, calls, documents, and next steps behind each deal. Keep the pipeline current from the work you’re already doing."
          group="CRM"
          details={homepageFeatureDetails.crm}
        >
          <DeferredDemo
            preload={loadCrmRecord}
            fallback={<DemoPlaceholder label="CRM pipeline preview" />}
          >
            <CrmRecordDemo />
          </DeferredDemo>
        </Feature>
        <HomepageTestimonials />
        <HomepageBlog />
        <HomepageClosing root={() => root} />
      </div>
    </div>
  );
}
