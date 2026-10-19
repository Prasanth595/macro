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
        title={['Find the', 'right email']}
        description="Macro tags incoming email by customer, project, or follow-up. Find related conversations across your accounts and keep them connected to the documents and tasks your team is working on."
        details={[
          {
            title: 'Automatic tagging',
            summary: 'Organize incoming messages by customer and project.',
            text: 'Incoming email gets tags such as customer, project, or follow-up. Those labels are applied as messages arrive, so you can find the conversation by what it relates to.',
          },
          {
            title: 'Adjust a tag',
            summary: 'Add or remove labels as a conversation changes.',
            text: 'Open Tags on a thread to add or remove a label yourself. Automatic organization is a starting point; you can correct it as the conversation changes.',
          },
          {
            title: 'Find related work',
            summary: 'Use shared tags across emails, documents, and tasks.',
            text: 'A thread can carry both a customer tag and a project tag. Those same tags work on documents and tasks, giving you another way to find everything connected to the conversation.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailAutoTagsDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="email-sharing"
        title={['Bring your team', 'into the thread']}
        description="Bring a customer conversation into your team’s channel without forwarding a copy. Share the full email thread, discuss it together, and keep new replies available in the same place."
        details={[
          {
            title: 'Share the whole thread',
            summary: 'Give your channel the original messages and attachments.',
            text: 'Choose a channel and add a note when sharing. Teammates can read the original email messages and attachments from the channel.',
          },
          {
            title: 'Keep new replies together',
            summary: 'New customer replies stay in the same shared thread.',
            text: 'The shared item is the live thread. When the customer replies, that message becomes available in the same shared thread instead of requiring another forward.',
          },
          {
            title: 'Discuss the next step',
            summary: 'Plan the response with your team beside the email.',
            text: 'Leave a comment alongside the email and mention the doc or task it relates to. Your internal discussion stays with the customer context your team needs.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailSharingDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="keyboard-speed"
        title={['Move through', 'your inbox']}
        description="Move through your inbox without reaching for the mouse. Open a thread, write a reply, and mark it done, with search across all your connected accounts in the same place."
        details={[
          {
            title: 'Navigate with J and K',
            summary:
              'Move between conversations without reaching for the mouse.',
            text: 'Use J and K to move to the next or previous conversation. These shortcuts also work with a thread open, so you can keep moving through the inbox.',
          },
          {
            title: 'Open and return',
            summary: 'Open a thread and return to the list from your keyboard.',
            text: 'Press Enter to open the selected thread and Escape to return to the list. Keep your hands on the keyboard as you move between the inbox and its conversations.',
          },
          {
            title: 'Mark it done',
            summary: 'Clear a conversation from the active list with E.',
            text: 'Press E when a conversation no longer needs attention. The selected conversation leaves the active list so you can move to the next one.',
          },
          {
            title: 'Search all accounts',
            summary: 'Find email across connected accounts in one search.',
            text: 'Search across your connected Gmail accounts from one inbox. Each result keeps its original account and sender when you open the conversation.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <EmailKeyboardDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="agentic-editing"
        title={['Start with', 'a better draft']}
        description="Ask an agent to prepare a reply using the email thread, relevant documents, and meeting transcript. You get an editable draft with the context already included, ready for your review."
        details={[
          {
            title: 'Use the meeting context',
            summary: 'Draft a follow-up using the thread and call transcript.',
            text: 'Ask for a follow-up that draws on the email thread and the meeting transcript. The agent can read the sources you reference before writing the draft.',
          },
          {
            title: 'Include the right people',
            summary: 'Prepare the recipients and attachments with the reply.',
            text: 'Ask the agent to copy the people involved and include a relevant attachment. Recipients and attachments are part of the draft you can inspect before sending.',
          },
          {
            title: 'Edit before sending',
            summary: 'Check the draft and approve it when it’s ready.',
            text: 'Review the subject, wording, recipients, and attachments. You can change the draft yourself and approve the send when it is ready.',
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
