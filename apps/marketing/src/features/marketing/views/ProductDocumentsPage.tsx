import { setPageSeo } from '../../../app/utils/utilSeo';
import { FeatureComparisons } from '../components/comparisons/FeatureComparisons';
import { DemoInteractionBoundary } from '../components/DemoInteractionBoundary';
import { DocumentOrganizationDemo } from '../components/documents/DocumentOrganizationDemo';
import { DocumentProjectDemo } from '../components/documents/DocumentProjectDemo';
import {
  DocumentAgentDemo,
  DocumentMentionsDemo,
} from '../components/documents/DocumentStories';
import { FeaturePageFaq, FeaturePageSection } from '../components/FeaturePage';
import { HomepageClosing } from '../components/HomepageClosing';
import {
  EditingGraphic,
  LinkedWorkGraphic,
  ThreadGraphic,
} from '../components/product/ProductGraphics';
import { ProductHero, ProductPage } from '../components/product/ProductPage';
import { WorkspaceDesktopDemo } from '../components/WorkspaceDesktopDemo';
import { documentComparisons } from '../core/feature-comparisons';

const documentsFaq = [
  {
    q: 'How is organizing docs different from Notion?',
    a: 'Notion stores uploaded files in pages or database properties. Importing a supported document converts its contents into a Notion page. Macro keeps docs and files as workspace items you can put in folders and tag alongside emails and tasks. Both support Markdown import and export.',
  },
  {
    q: 'What can I write in Macro?',
    a: 'Notes, briefs, proposals, handbooks, and everyday drafts. Use headings, checklists, tables, images, code, and Markdown shortcuts. Write together in real time and leave comments on specific text.',
  },
  {
    q: 'How does live collaboration work?',
    a: 'Macro uses CRDTs to merge edits from people and agents, even within the same paragraph. Everyone sees changes as they happen. You can also browse earlier versions of a doc and make a new copy from one.',
  },
  {
    q: 'Can I keep writing offline?',
    a: 'Yes. Keep editing an open doc when your connection drops. Changes save on your device and merge with your team’s edits when you reconnect.',
  },
  {
    q: 'Who can open a doc I share?',
    a: 'Share with individuals or mention the doc in a channel to give its members access. Choose view, comment, or edit access. Sources linked inside the doc keep their own permissions.',
  },
  {
    q: 'Can I share with someone outside Macro?',
    a: 'Yes. Share by email address or enable a public link. People can view the public document preview without creating an account.',
  },
  {
    q: 'Can I bring my docs in and take them out?',
    a: (
      <>
        Import Notion pages or upload files. Export native Macro docs as
        Markdown. See <a href="/migrate">moving to Macro</a>.
      </>
    ),
  },
];

export function RouteDocuments() {
  setPageSeo({
    title: 'Macro Docs | Write With Your Team and Your Agents',
    description:
      'Write in Markdown and collaborate live with people and agents. Link emails and tasks, open them beside your doc, and organize your work with folders and tags.',
    path: '/documents',
  });
  return (
    <ProductPage>
      <div class="docs-page">
        <ProductHero
          product="Docs"
          title={['Write with your team', 'and your agents.']}
          description={[
            'Write together using your emails, tasks,',
            'and conversations already in Macro.',
          ]}
          cta="documents_hero_get_started"
        />
        <WorkspaceDesktopDemo
          heroFrame
          view="documents"
          label="Explore Macro Docs"
        >
          <DocumentProjectDemo />
        </WorkspaceDesktopDemo>
        <nav
          class="feature-page-jump-links docs-jump-links"
          aria-label="On this page"
        >
          <a href="#document-agents">
            <EditingGraphic />
            <span>Write with agents</span>
          </a>
          <a href="#document-links">
            <LinkedWorkGraphic />
            <span>Link your work</span>
          </a>
          <a href="#document-organization">
            <ThreadGraphic />
            <span>Folders and tags</span>
          </a>
        </nav>
        <FeaturePageSection
          id="document-agents"
          title={['Write with', 'your agent']}
          description="Ask your agent to update a brief using your emails and tasks, then keep writing together. Your team and your agent work in the same shared document, with changes merging as you type."
          details={[
            {
              title: 'Update from an email',
              text: 'Point the agent to the pricing email and ask it to update the shared brief. It can read the source and change the document instead of giving you another block of text to paste.',
            },
            {
              title: 'Edit together',
              text: 'You, your teammates, and the agent work in the same document. Changes merge as you type, so you can review and refine the draft where the work is happening.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <DocumentAgentDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="document-links"
          title={['Open the source', 'beside your doc']}
          description="Link to the work you’re writing about and open it beside your document. Read the original email, task, or conversation while you write, without copying the information into another file."
          details={[
            {
              title: 'Reference the email',
              text: 'Add an inline mention of the email that contains the source information. Readers can open the original thread to check the wording or understand a decision.',
            },
            {
              title: 'Check the task',
              text: 'Mention the task that tracks a next step. Open it from the doc to see the requirements and status while keeping the plan in view.',
            },
            {
              title: 'Read side by side',
              text: 'Open a linked item beside the document. You can check the source as you write without moving between separate browser tabs.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual docs-wide-demo">
            <DocumentMentionsDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="document-organization"
          title={['Find docs', 'where you work']}
          description="Keep documents in folders and use tags to find them across projects. A brief can stay in its home folder while appearing beside related emails and tasks under the tags your team uses."
          details={[
            {
              title: 'Give docs a home',
              text: 'Put the brief, notes, and supporting files in a project folder. Browse that folder when you want the work your team has deliberately grouped together.',
            },
            {
              title: 'Find them by tag',
              text: 'Apply more than one tag to a document. It can stay in its folder and also appear with related emails and tasks under a shared project or topic.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <DocumentOrganizationDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <section
          id="documents-comparison"
          aria-label="Compare Macro and Notion"
        >
          <FeatureComparisons comparisons={documentComparisons} />
        </section>
        <div>
          <FeaturePageFaq
            id="documents-faq-title"
            title="Frequently asked questions"
            items={documentsFaq}
          />
        </div>
        <HomepageClosing />
      </div>
    </ProductPage>
  );
}
