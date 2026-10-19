import MacroLogo from '@icon/macro-logo.svg';
import { DemoInteractionBoundary } from '../../features/marketing/components/DemoInteractionBoundary';
import { EmailAgenticEditingDemo } from '../../features/marketing/components/email/EmailAgenticEditingDemo';
import { EmailAutoTagsDemo } from '../../features/marketing/components/email/EmailAutoTagsDemo';
import { EmailComparison } from '../../features/marketing/components/email/EmailComparison';
import { EmailDesktopDemo } from '../../features/marketing/components/email/EmailDesktopDemo';
import {
  AgenticEditingGraphic,
  AutoTagsGraphic,
  EmailSharingGraphic,
  KeyboardSpeedGraphic,
} from '../../features/marketing/components/email/EmailFeatureGraphics';
import { EmailKeyboardDemo } from '../../features/marketing/components/email/EmailKeyboardDemo';
import { EmailSharingDemo } from '../../features/marketing/components/email/EmailSharingDemo';
import {
  FeaturePage,
  FeaturePageCta,
  FeaturePageFaq,
  FeaturePageSection,
} from '../../features/marketing/components/FeaturePage';
import { HomepageClosing } from '../../features/marketing/components/HomepageClosing';
import { setPageSeo } from '../utils/utilSeo';
import '../../features/marketing/components/email/email-hero.css';

const faqItems = [
  {
    q: 'Does Macro work with my existing email account?',
    a: 'Macro supports Gmail and Google Workspace. Connect your existing account to read and send email in Macro. You can continue using Gmail alongside it.',
  },
  {
    q: 'Can I connect more than one account?',
    a: 'Yes. View connected accounts in one inbox, or filter to a single account. Each message keeps its original sender and account.',
  },
  {
    q: 'What can an agent do with my email?',
    a: 'An agent can help draft and edit replies using email and the workspace context available to it. Review the draft, make changes, and approve it before sending.',
  },
  {
    q: 'How do Signal and Noise work?',
    a: 'Signal keeps important conversations together. Noise groups lower-priority mail, such as newsletters and automated updates. You can move a thread between the two views.',
  },
  {
    q: 'Can I share an email with a channel?',
    a: 'Yes. Share a thread with your team and link it in a channel. Teammates with access can open the conversation, including later replies, without forwarding a separate copy.',
  },
  {
    q: 'Is my email used to train AI?',
    a: 'Data received through Google Workspace APIs is not used to develop or train generalized AI models. Macro maintains zero data retention agreements with OpenAI and Anthropic for model processing.',
  },
  {
    q: 'Can I disconnect my account?',
    a: (
      <>
        Disconnect in Macro’s Settings or revoke access from your Google
        account. Revoking access and deleting data already stored in Macro are
        separate actions. Our <a href="/privacy">Privacy Policy</a> explains
        data deletion.
      </>
    ),
  },
  {
    q: 'Is Macro open source?',
    a: (
      <>
        Yes. You can inspect the application code on{' '}
        <a
          href="https://github.com/macro-inc/macro"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        . Open source does not make your email or workspace public.
      </>
    ),
  },
  {
    q: 'Can I join as a Guest for free?',
    a: (
      <>
        Yes. Guest access includes email alongside chat, documents, tasks, and
        AI, with usage limits. See <a href="/pricing">pricing</a> for current
        account, storage, and AI limits.
      </>
    ),
  },
];

export function RouteEmail() {
  setPageSeo({
    title: 'Macro Mail — The AI Email Client',
    description:
      'Bring your email accounts into one inbox. Draft and edit with agents, separate signal from noise, and share email threads with your team in Macro.',
    path: '/email',
  });

  return (
    <FeaturePage productSpacing>
      <header class="feature-page-hero email-page-hero">
        <p class="email-page-hero-label">
          <MacroLogo aria-hidden="true" />
          <span>Macro Mail</span>
        </p>
        <h1>
          <span>Extremely fast email for</span>
          <span>humans and agents.</span>
        </h1>
        <p class="email-page-hero-description">
          All your accounts in one inbox. Search across them.
          <br class="email-page-hero-break" /> Share threads. Let agents draft
          your replies.
        </p>
        <FeaturePageCta name="email_hero_get_started" />
      </header>
      <EmailDesktopDemo />
      <nav
        class="feature-page-jump-links email-feature-links"
        aria-label="On this page"
      >
        <a href="#auto-tags">
          <AutoTagsGraphic />
          <span>Automatic tags</span>
        </a>
        <a href="#email-sharing">
          <EmailSharingGraphic />
          <span>Share to a channel</span>
        </a>
        <a href="#keyboard-speed">
          <KeyboardSpeedGraphic />
          <span>Superhuman speed</span>
        </a>
        <a href="#agentic-editing">
          <AgenticEditingGraphic />
          <span>Agentic editing</span>
        </a>
      </nav>
      <FeaturePageSection
        id="auto-tags"
        title="Find the right email"
        description="Macro tags incoming email by customer, project, or follow-up. Find related conversations across your accounts and keep them connected to the documents and tasks your team is working on."
        details={[
          {
            title: 'Automatic tags',
            text: 'Incoming messages receive tags that help organize your inbox. You can add, remove, or change a tag yourself when a conversation belongs somewhere else.',
          },
          {
            title: 'Related work together',
            text: 'A thread can have several tags, such as a customer and a project. The same tags also work on documents and tasks, so related work is easier to find.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailAutoTagsDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="email-sharing"
        title="Bring your team into the thread"
        description="Bring a customer conversation into your team’s channel without forwarding a copy. Share the full email thread, discuss it together, and keep new replies available in the same place."
        details={[
          {
            title: 'Share a live thread',
            text: 'Choose a channel, add a note, and share the email. Channel members can open the original messages and attachments, including new replies as they arrive.',
          },
          {
            title: 'Discuss it with your team',
            text: 'Comment beside the email and mention the documents or tasks it relates to. Your team can read the customer’s words and agree on the next step together.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailSharingDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="keyboard-speed"
        title="Move through your inbox"
        description="Move through your inbox without reaching for the mouse. Open a thread, write a reply, and mark it done, with search across all your connected accounts in the same place."
        details={[
          {
            title: 'Keyboard navigation',
            text: 'Use J and K to move between threads, Enter to open one, and E to mark it done. Escape returns you to the list. Navigation also works with a thread open.',
          },
          {
            title: 'Search across accounts',
            text: 'Find messages across your connected Gmail accounts from one inbox. Open a result to read the conversation without switching between separate account windows.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailKeyboardDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="agentic-editing"
        title="Start with a better draft"
        description="Ask an agent to prepare a reply using the email thread, relevant documents, and meeting transcript. You get an editable draft with the context already included, ready for your review."
        details={[
          {
            title: 'Draft with context',
            text: 'Agents can search past emails and read the docs and calls you reference. Ask for a follow-up, a proposal attachment, or a reply that includes the people involved.',
          },
          {
            title: 'Review before sending',
            text: 'Check the subject, recipients, wording, and attachments in the draft. Make any changes and approve the send when you’re ready.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailAgenticEditingDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <EmailComparison />
      <FeaturePageFaq
        id="email-faq-title"
        title="Gmail accounts and agent permissions"
        introduction={
          <p>
            Macro connects to your existing Google account. You can read,
            organize, and reply to email alongside your team’s work. You approve
            the connection on Google. Macro does not receive your Google
            password. Email agents show you the draft and ask for approval
            before sending.
          </p>
        }
        items={faqItems}
      />
      <HomepageClosing />
    </FeaturePage>
  );
}
