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
        title={['Open the work', 'from chat']}
        description="Share the work itself in your team’s conversation. Click a mention to open a document, task, or email beside chat, so the discussion and the thing you’re working on stay in view."
        details={[
          {
            title: 'Read the customer email',
            summary: 'Read the original thread beside the team discussion.',
            text: 'Click the shared email mention to read the original thread beside chat. Your team can discuss the request while looking at the customer’s words.',
          },
          {
            title: 'Edit the shared doc',
            summary: 'Update the shared checklist without closing chat.',
            text: 'Open the document mentioned in the conversation and work on the shared file. Keep the channel next to the launch checklist as you update it.',
          },
          {
            title: 'Open the next task',
            summary: 'Open the task that tracks the conversation’s next step.',
            text: 'Follow the task mention to see what needs doing. The link connects the conversation to the task that tracks the next step.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual channel-wide-demo">
          <ChannelSharedWorkDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="channel-access"
        title={['Share once', 'with the team']}
        description="Mention a document, task, or email to share it with the channel. The people in the conversation can open the work, and new channel members get access to those shared items too."
        details={[
          {
            title: 'Give the channel access',
            summary: 'Mention an item so channel members can open it.',
            text: 'Mention a document, task, or email in the channel. Members can open that shared item directly from the conversation.',
          },
          {
            title: 'Include new members',
            summary: 'Give new teammates access to the work already shared.',
            text: 'People who join the channel also get access to its shared items. They can read earlier discussion and open the work it refers to while catching up.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <ChannelPermissionsDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="channel-agents"
        title={['Work with agents', 'in chat']}
        description="Bring an agent into the conversation where your team is already working. Ask for help, add context, and follow the result together, using Macro’s agents or an agent you connect yourself."
        details={[
          {
            title: 'Ask in front of the team',
            summary: 'Make the request where teammates can follow along.',
            text: 'Mention an agent with your request in the channel. Teammates can see the request, add context, and follow its response.',
          },
          {
            title: 'Reference the actual work',
            summary: 'Point the agent to the shared document or task.',
            text: 'Mention the document or task the agent should use. Give it the shared source so its response is grounded in the work being discussed.',
          },
          {
            title: 'Bring your own agent',
            summary: 'Bring a connected agent into your team’s conversation.',
            text: 'Connect a supported agent you already use. It can participate in the workspace conversation while using its own runtime and permission settings.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <ChannelAgentDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="catch-up"
        title={['Catch up', 'in one place']}
        description="Read replies without opening every conversation separately. Follow the thread inline, see what the team said, and respond in the same place when something needs your attention."
        details={[
          {
            title: 'Expand a thread',
            summary:
              'Read replies without leaving the surrounding conversation.',
            text: 'Read replies inline while keeping the surrounding channel in view. You do not need to open a separate conversation just to understand the follow-up.',
          },
          {
            title: 'Reply where it belongs',
            summary: 'Keep your response with the message it answers.',
            text: 'Respond in the original thread. Your reply stays with the message and discussion it answers, where the other participants can find it.',
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
