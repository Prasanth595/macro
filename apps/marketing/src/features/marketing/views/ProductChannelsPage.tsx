import { setPageSeo } from '../../../app/utils/utilSeo';
import {
  ChannelAgentDemo,
  ChannelHero,
  ChannelPermissionsDemo,
  ChannelSharedWorkDemo,
  ChannelThreadDemo,
} from '../components/channels/ChannelStories';
import { FeatureComparisons } from '../components/comparisons/FeatureComparisons';
import { DemoInteractionBoundary } from '../components/DemoInteractionBoundary';
import { FeaturePageFaq, FeaturePageSection } from '../components/FeaturePage';
import { HomepageClosing } from '../components/HomepageClosing';
import {
  ContextGraphic,
  LinkedWorkGraphic,
  ThreadGraphic,
} from '../components/product/ProductGraphics';
import { ProductHero, ProductPage } from '../components/product/ProductPage';
import { TaskAgentsGraphic } from '../components/tasks/TasksFeatureGraphics';
import { chatComparisons } from '../core/feature-comparisons';

export function RouteChannels() {
  setPageSeo({
    title: 'Macro Chat: Bring the Work into the Conversation',
    description:
      'Share documents, tasks, and email threads in team chat. Channel members get access, work stays linked to its discussion, and follow-ups wait in one inbox.',
    path: '/channels',
  });
  return (
    <ProductPage>
      <ProductHero
        product="Chat"
        title={['Team chat, wired into', 'everything else.']}
        description={[
          '@mention a doc, task, person, or company',
          'and the whole channel can open it natively.',
        ]}
        cta="channels_hero_get_started"
      />
      <ChannelHero />
      <nav class="feature-page-jump-links" aria-label="On this page">
        <a href="#shared-work">
          <LinkedWorkGraphic />
          <span>Open the work</span>
        </a>
        <a href="#channel-access">
          <ContextGraphic />
          <span>Channel access</span>
        </a>
        <a href="#channel-agents">
          <TaskAgentsGraphic />
          <span>Agents</span>
        </a>
        <a href="#catch-up">
          <ThreadGraphic />
          <span>Catch up</span>
        </a>
      </nav>
      <FeaturePageSection
        id="shared-work"
        title="Open the work from chat"
        description="Share the work itself in your team’s conversation. Click a mention to open a document, task, or email beside chat, so the discussion and the thing you’re working on stay in view."
        details={[
          {
            title: 'Open linked work',
            text: 'Mention a document, task, or email directly in a message. Teammates can open the original item from the conversation instead of looking for a separate link or attachment.',
          },
          {
            title: 'Work beside the discussion',
            text: 'Keep the channel visible while you read an email or update a document. Return to the conversation with the source still close at hand.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual channel-wide-demo">
          <ChannelSharedWorkDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="channel-access"
        title="Share once with the team"
        description="Mention a document, task, or email to share it with the channel. The people in the conversation can open the work, and new channel members get access to those shared items too."
        details={[
          {
            title: 'Share with the channel',
            text: 'An item mentioned in a channel becomes accessible to its members. The team can follow the reference and work from the same document, task, or email thread.',
          },
          {
            title: 'Bring new members up to speed',
            text: 'People joining the channel can access its shared items. They can read the conversation and open the work that gives it context.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <ChannelPermissionsDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="channel-agents"
        title="Put agents in the conversation"
        description="Bring an agent into the conversation where your team is already working. Ask for help, add context, and follow the result together, using Macro’s agents or an agent you connect yourself."
        details={[
          {
            title: 'Ask in the conversation',
            text: 'Mention an agent with a request and references to the relevant work. Your teammates can see what you asked and respond in the same channel.',
          },
          {
            title: 'Use your own agent',
            text: 'Connect an agent you already use and bring it into your workspace. Its work stays part of the team conversation, where you can give feedback and follow up.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <ChannelAgentDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="catch-up"
        title="Catch up in one place"
        description="Read replies without opening every conversation separately. Follow the thread inline, see what the team said, and respond in the same place when something needs your attention."
        details={[
          {
            title: 'Read replies inline',
            text: 'Expand a thread to see its replies alongside the channel. Keep the surrounding conversation visible while you catch up on the details.',
          },
          {
            title: 'Reply in context',
            text: 'Add your response to the thread it belongs to. The discussion stays connected to the original message rather than becoming a separate conversation.',
          },
        ]}
      >
        <span id="channel-threads" />
        <span id="chat-inbox" />
        <DemoInteractionBoundary class="feature-page-visual">
          <ChannelThreadDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeatureComparisons comparisons={chatComparisons} />
      <FeaturePageFaq
        id="channels-faq-title"
        title="FAQ"
        items={[
          {
            q: 'What happens when I share an email?',
            a: (
              <>
                The channel can read the full thread, including new replies. See{' '}
                <a href="/email">email sharing</a>.
              </>
            ),
          },
          {
            q: 'Can a message become a task?',
            a: (
              <>
                Yes. Use a message’s Task action, or ask an agent to create one.
                See <a href="/tasks">Macro Tasks</a>.
              </>
            ),
          },
          {
            q: 'Can I quiet a noisy channel?',
            a: 'Yes. Mute or snooze notifications for any channel from its menu.',
          },
          {
            q: 'Which agents can I mention?',
            a: (
              <>
                Macro’s agents, or agents you connect to your workspace. See how
                to <a href="/agents">bring your own agent</a>.
              </>
            ),
          },
          {
            q: 'How do we get started?',
            a: (
              <>
                Create a channel and invite your team by email. Bringing work
                over from another app? See{' '}
                <a href="/migrate">how to move to Macro</a>.
              </>
            ),
          },
          {
            q: 'Can I join as a Guest for free?',
            a: (
              <>
                Yes. Guest access is free. See <a href="/pricing">pricing</a>{' '}
                for current access and limits.
              </>
            ),
          },
        ]}
      />
      <HomepageClosing />
    </ProductPage>
  );
}
