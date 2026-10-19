import { lazy } from 'solid-js';
import { CrmCaptureDemo } from '../../features/marketing/components/crm/CrmCaptureDemo';
import { CrmComparison } from '../../features/marketing/components/crm/CrmComparison';
import { CrmEnrichmentDemo } from '../../features/marketing/components/crm/CrmEnrichmentDemo';
import {
  AgentIllustration,
  CaptureIllustration,
  ContextIllustration,
  EnrichmentIllustration,
} from '../../features/marketing/components/crm/CrmFeatureIllustrations';
import { CrmRecordDemo } from '../../features/marketing/components/crm/CrmRecordDemo';
import {
  DeferredDemo,
  DemoPlaceholder,
} from '../../features/marketing/components/DeferredDemo';
import { DemoInteractionBoundary } from '../../features/marketing/components/DemoInteractionBoundary';
import {
  FeaturePageFaq,
  FeaturePageSection,
} from '../../features/marketing/components/FeaturePage';
import { HomepageClosing } from '../../features/marketing/components/HomepageClosing';
import { HomepageConversation } from '../../features/marketing/components/HomepageConversation';
import {
  ProductHero,
  ProductPage,
} from '../../features/marketing/components/product/ProductPage';
import { WorkspaceDesktopDemo } from '../../features/marketing/components/WorkspaceDesktopDemo';
import { setPageSeo } from '../utils/utilSeo';
import '../../features/marketing/components/crm/crm-page.css';

const loadPipeline = () =>
  import('../../features/marketing/components/HomepageCrm');
const PipelineDemo = lazy(loadPipeline);

const faqItems = [
  {
    q: 'How are companies and contacts created?',
    a: 'From your email. When someone on your team emails a person at a new domain, Macro creates the contact and the company, and groups everyone from that domain under it. Personal addresses like Gmail don’t become companies. You can also add companies by hand or import a CSV.',
  },
  {
    q: 'What is automatic enrichment?',
    a: 'When Macro creates a company, it looks up the domain and adds a short description from public sources, so you know who they are without opening another tab. Stage, owner, revenue, and everything else you know about the deal are yours to fill in.',
  },
  {
    q: 'Can I update records myself?',
    a: 'Yes. Drag a company to a new stage on the board, or open it and change Stage, Owner, Revenue, or any custom property you’ve added. Agents edit the same properties, so their changes and yours end up in the same place.',
  },
  {
    q: 'Where does the team discuss a customer?',
    a: 'On the company. Every company has a Discussion that works like a thread in a channel: reply, react, and @mention people, docs, or tasks. The pricing conversation stays with the customer instead of scrolling away in #sales.',
  },
  {
    q: 'Can I mention a company in a document or channel?',
    a: 'Yes. Type @ and pick it from Companies. The mention links to the company’s record, and opening it follows the record’s normal access rules.',
  },
  {
    q: 'What can agents do with the CRM?',
    a: 'Agents can list companies, read a record with its contacts and properties, and set Stage, Owner, Revenue, or your custom properties. @mention Claude in a company’s Discussion, or ask in a channel after your sales sync. The same tools are on our MCP server, so Claude, ChatGPT, and Cursor can use them too.',
  },
  {
    q: 'Is CRM available for my account?',
    a: 'We’re rolling it out. If you don’t see Customers in your sidebar yet, it hasn’t reached your account. And being open source doesn’t make your data public: Macro’s code is AGPLv3, but your companies, contacts, and emails stay private to your team.',
  },
];

export function RouteCrm() {
  setPageSeo({
    title: 'Macro CRM — The Self-Building CRM',
    description:
      'Companies and contacts built from your email, enriched automatically, and kept current by agents. Right in your workspace, so there’s no separate tool to check.',
    path: '/crm',
  });
  return (
    <ProductPage>
      <ProductHero
        product="CRM"
        title={['The CRM that', 'updates itself.']}
        description={[
          'Built from your email and calls, kept current by agents.',
          'Right in your workspace, so there’s no separate tool to check.',
        ]}
        cta="crm_hero_get_started"
      />
      <WorkspaceDesktopDemo
        heroFrame
        view="crm"
        label="Explore Macro CRM"
        caption="A sample pipeline. Drag a company to a new stage or open its record."
      />
      <nav
        class="feature-page-jump-links crm-feature-links"
        aria-label="On this page"
      >
        <a href="#crm-from-email">
          <span class="crm-feature-illustration">
            <CaptureIllustration />
          </span>
          <span>Updated by agents</span>
        </a>
        <a href="#crm-enrichment">
          <span class="crm-feature-illustration">
            <EnrichmentIllustration />
          </span>
          <span>Auto-enriched</span>
        </a>
        <a href="#crm-context">
          <span class="crm-feature-illustration">
            <ContextIllustration />
          </span>
          <span>The whole relationship</span>
        </a>
        <a href="#crm-agents">
          <span class="crm-feature-illustration">
            <AgentIllustration />
          </span>
          <span>Agents and MCP</span>
        </a>
      </nav>
      <FeaturePageSection
        id="crm-from-email"
        title={['Keep your', 'CRM current']}
        description="Your CRM lives beside your email, calls, and chat. Ask an agent to update stages, owners, and next steps from those conversations so your team can work from a current customer record."
        details={[
          {
            title: 'Move a deal’s stage',
            summary: 'Turn a customer update into a pipeline stage change.',
            text: 'Tell the agent what changed in the customer conversation. A request for a product demo can become a stage update on the company record.',
          },
          {
            title: 'Set the account owner',
            summary: 'Assign responsibility on the shared customer record.',
            text: 'Include the new owner in the same request. The assignment is saved on the shared record so the team can see who is responsible.',
          },
          {
            title: 'Record the next step',
            summary: 'Keep the handoff details with the customer.',
            text: 'Add the detail that matters for the handoff, such as who is coordinating the rollout. Keep that context on the customer record instead of only in the sales conversation.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmCaptureDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-enrichment"
        title={['Know who', 'you’re meeting']}
        description="When you email someone new, Macro creates the contact and company from their domain. Public company details fill in the record, so you have a starting point before the first meeting."
        details={[
          {
            title: 'Create contacts from email',
            summary: 'Start the customer record from a new email relationship.',
            text: 'Emailing someone new creates a contact and a company from their domain. You can open the relationship from the conversation instead of entering the same person in a separate tool.',
          },
          {
            title: 'Fill in company details',
            summary:
              'Fill the record with publicly available company information.',
            text: 'Macro adds publicly available company information to the record. Review it and add what you learn yourself as the relationship develops.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmEnrichmentDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-context"
        title={['See the whole', 'relationship']}
        description="Open a company to see the people, emails, calls, files, and tasks behind the relationship. Keep notes on the customer record so the next person can understand what’s happened and what comes next."
        details={[
          {
            title: 'People at the company',
            summary: 'See the contacts involved in the account.',
            text: 'Open the company’s contacts to see the people involved in the relationship. Keep the account context close when a new person joins the conversation.',
          },
          {
            title: 'Emails and calls',
            summary: 'Read the original conversations behind the relationship.',
            text: 'Read customer threads and open related calls from the record. Go back to the original conversation when a summary does not give you enough detail.',
          },
          {
            title: 'Files and tasks',
            summary: 'Find shared documents and the work still in progress.',
            text: 'Find the documents shared with the company and the work still in progress. The record brings those references together without making another copy of the files.',
          },
          {
            title: 'Customer notes',
            summary: 'Keep account notes where the team can find them.',
            text: 'Use the record’s discussion for notes your team needs later. Mention the company in a doc or channel to link colleagues back to the same shared record.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmRecordDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-agents"
        title={['Keep deals', 'moving']}
        description="After a sales call, tell your agent which deals moved and what needs updating. Agents can read customer records and change their properties, whether you use them in Macro or through a connected tool."
        details={[
          {
            title: 'Update after the sales sync',
            summary: 'Update deal stages from a description of the meeting.',
            text: 'Tell an agent which deals moved and which stage each should be in. A short description of the sales meeting can update the shared pipeline without editing each record yourself.',
          },
          {
            title: 'Work through MCP',
            summary: 'Read and update the same records from a connected agent.',
            text: 'Connected agents can list companies, read records, and update their properties through Macro’s MCP server. Use the same customer data from Macro or a supported external client.',
          },
        ]}
      >
        <DemoInteractionBoundary class="feature-page-visual crm-agent-scene">
          <HomepageConversation
            messages={[
              {
                person: 'valentina',
                text: (
                  <>
                    <span class="homepage-person-mention">@Claude</span>, update
                    the pipeline from our sales sync. Keystone Mechanical asked
                    for a proposal, and Bookend Retail signed.
                  </>
                ),
              },
            ]}
          />
          <div class="crm-pipeline-frame glass-input">
            <DeferredDemo
              preload={loadPipeline}
              fallback={
                <DemoPlaceholder label="Agent updates the customer pipeline" />
              }
            >
              <PipelineDemo playbackControls={false} />
            </DeferredDemo>
          </div>
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageFaq
        id="crm-faq-title"
        title="Questions about Macro CRM"
        introduction={
          <p>
            If you’re coming from HubSpot, Attio, or a spreadsheet, here’s
            what’s different.
          </p>
        }
        items={faqItems}
      />
      <CrmComparison />
      <HomepageClosing />
    </ProductPage>
  );
}
