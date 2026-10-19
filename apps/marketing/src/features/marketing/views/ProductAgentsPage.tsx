import ArrowUpRight from '@phosphor/arrow-up-right.svg';
import CaretDown from '@phosphor/caret-down.svg';
import { setPageSeo } from '../../../app/utils/utilSeo';
import { AgentMcpSetup } from '../components/agents/AgentStories';
import {
  AgentDeliverableStory,
  AgentMeetingStory,
  AgentTeamworkStory,
} from '../components/agents/AgentWorkflowStories';
import { DemoInteractionBoundary } from '../components/DemoInteractionBoundary';
import { FeaturePageFaq, FeaturePageSection } from '../components/FeaturePage';
import { HomepageClosing } from '../components/HomepageClosing';
import {
  ContextGraphic,
  EditingGraphic,
  LinkedWorkGraphic,
  ThreadGraphic,
} from '../components/product/ProductGraphics';
import { ProductHero, ProductPage } from '../components/product/ProductPage';
import { WorkspaceDesktopDemo } from '../components/WorkspaceDesktopDemo';
import './agents-page.css';

const agentsFaq = [
  {
    q: 'Can I choose a different model?',
    a: 'Yes. Choose from the models in Macro’s agent picker when starting or continuing a conversation. A connected agent uses the models supported by its own runtime.',
  },
  {
    q: 'Whose permissions does an agent use?',
    a: 'Hosted agents use the conversation owner’s access. Someone else prompting a shared conversation may need the owner’s approval. Connected agents also follow their own permission settings.',
  },
  {
    q: 'Can I review an email before it goes out?',
    a: 'Yes. Review and edit the draft in the conversation, then send it. In a channel or document discussion, the agent asks for confirmation in the thread. External clients have their own review controls.',
  },
  {
    q: 'Can an agent work while I’m away?',
    a: 'Hosted agents can continue after you close the app. Local agents need your machine to stay online. Routines let you schedule recurring work.',
  },
];

export function RouteAgents() {
  // The router coalesces a click on the current hash. Still scroll back to it
  // when the visitor has moved elsewhere on this long page.
  const revisitSection = (
    event: MouseEvent & { currentTarget: HTMLAnchorElement }
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const hash = event.currentTarget.hash;
    if (hash !== window.location.hash) return;
    event.preventDefault();
    document.getElementById(hash.slice(1))?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };
  setPageSeo({
    title: 'Macro Agents | Agents That Know What Your Team Is Doing',
    description:
      'Give agents native access to the context and tools behind your work. Use workspace permissions, choose a model, mention agents in chat, or bring your own agent.',
    path: '/agents',
  });
  return (
    <ProductPage>
      <div class="agents-hero">
        <ProductHero
          product="Agents"
          title={['Agents that know', 'what your team is doing.']}
          description={[
            'Give agents your company’s context',
            'to get things done alongside your team.',
          ]}
          cta="agents_hero_get_started"
        />
      </div>
      <WorkspaceDesktopDemo
        heroFrame
        view="messages"
        agentShowcase
        desktopWidth={1000}
        label="Delegate work from a team conversation"
      />
      <nav class="feature-page-jump-links" aria-label="On this page">
        <a onClick={revisitSection} href="#agent-sources">
          <ContextGraphic />
          <span>Your personal agent</span>
        </a>
        <a onClick={revisitSection} href="#agent-actions">
          <EditingGraphic />
          <span>Tools to act</span>
        </a>
        <a onClick={revisitSection} href="#agent-collaboration">
          <ThreadGraphic />
          <span>Agents on your team</span>
        </a>
        <a onClick={revisitSection} href="#existing-agents">
          <LinkedWorkGraphic />
          <span>Bring your own agent</span>
        </a>
      </nav>
      <FeaturePageSection
        id="agent-sources"
        title={['Get answers', 'with context']}
        description="Ask a question that draws on more than one app’s worth of information. Your agent can use your calendar, earlier conversations, and customer messages to prepare an answer grounded in your work."
        details={[
          {
            title: 'Prepare for a meeting',
            text: 'Ask what you should know before tomorrow’s customer calls. Your agent can start from the calendar and gather the context needed for a useful brief.',
          },
          {
            title: 'Connect the conversations',
            text: 'The agent can read earlier discussions and customer messages it has access to. It can combine those sources instead of treating the meeting as an isolated calendar event.',
          },
          {
            title: 'Check the sources',
            text: 'Open the items referenced in the result to check a detail yourself. Continue the conversation with more context or ask the agent to take the next step.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <AgentMeetingStory />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="agent-actions"
        title={['Make progress', 'together']}
        description="Work with your agent in the same file your team uses. Add context, ask for an update, and review the result in the shared document instead of moving drafts back and forth."
        details={[
          {
            title: 'Change the shared file',
            text: 'Ask the agent to update the document your team is using. Its work appears in that file instead of becoming a separate draft you need to move across.',
          },
          {
            title: 'Keep refining it',
            text: 'Open the document, edit it yourself, and ask for another pass. Your teammates can contribute to the same file as the work develops.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <AgentDeliverableStory />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="agent-collaboration"
        title={['From idea', 'to working code']}
        description="Bring design and implementation into the team conversation. Ask Macro for a mockup, give feedback together, then tag Cursor to build it using the context already in the channel."
        details={[
          {
            title: 'Make a mockup',
            text: 'Ask Macro to turn the client brief into a mockup. Open the result directly from the conversation to see what it produced.',
          },
          {
            title: 'Give feedback together',
            text: 'Discuss what to change in the channel. The team can see the mockup and the feedback that should guide the next version.',
          },
          {
            title: 'Bring in Cursor',
            text: 'Tag the connected coding agent when the direction is clear. It can continue from the brief, mockup, and conversation already shared with the team.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <AgentTeamworkStory />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="existing-agents"
        title={['Bring your', 'own agent']}
        description="Keep the agents you already use and connect them to your work in Macro. Bring a locally running agent into the workspace, or give an external MCP client access to Macro’s tools and context."
        details={[
          {
            title: 'Connect through macrod',
            text: 'Bring a supported agent such as Claude Code, OpenCode, OpenClaw, or Hermes into Macro while it runs on your machine. The setup links above cover connection instructions.',
          },
          {
            title: 'Use Macro through MCP',
            text: 'Connect Macro’s MCP server to Claude, ChatGPT, Cursor, or another supported client. Work with the available Macro search, reading, and editing tools from that client.',
          },
          {
            title: 'Keep your runtime',
            text: 'A connected agent uses the models and permission settings supported by its own runtime. Connecting it to Macro does not mean switching to a different coding subscription.',
          },
        ]}
      >
        <div class="agents-connections">
          <div class="agents-connection-paths">
            <div class="agents-connection-path">
              <h3>Your agent, inside Macro</h3>
              <p>
                Bring Claude Code, OpenCode, OpenClaw, or Hermes into your
                workspace. Connect through macrod and keep your agent running on
                your machine.
              </p>
              <a
                class="agents-setup-link"
                href="https://docs.macro.com/AI/bring-your-own"
              >
                Connect your agent <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
            <div class="agents-connection-path">
              <h3>Macro, inside your agent</h3>
              <p>
                Use Macro from Claude, ChatGPT, Cursor, or another MCP client.
                Search your workspace and work with its documents and tasks from
                there.
              </p>
              <a
                class="agents-setup-link"
                href="https://docs.macro.com/AI/mcp/overview"
              >
                Connect with MCP <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </div>
          <details class="agents-mcp-disclosure">
            <summary>
              MCP connection commands <CaretDown aria-hidden="true" />
            </summary>
            <div
              class="agents-mcp-content workspace-demo portal-scope"
              data-theme="dark"
            >
              <AgentMcpSetup />
            </div>
          </details>
        </div>
      </FeaturePageSection>
      <FeaturePageFaq
        id="agents-faq-title"
        title="Models, permissions, and control."
        items={agentsFaq}
      />
      <HomepageClosing />
    </ProductPage>
  );
}
