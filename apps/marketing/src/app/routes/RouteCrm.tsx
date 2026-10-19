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
  ProductProse,
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
        title="Keep your CRM current"
        description="Update stages and owners from your conversations."
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmCaptureDemo />
        </DemoInteractionBoundary>
        <ProductProse>
          <p>
            Ask an agent to update a stage or owner using the email, call, or
            conversation where the change happened.
          </p>
        </ProductProse>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-enrichment"
        title="Know who you’re meeting"
        description="Company details, filled in from the first email."
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmEnrichmentDemo />
        </DemoInteractionBoundary>
        <ProductProse>
          <p>
            New contacts and companies are created from email. Public company
            details fill in the record automatically.
          </p>
        </ProductProse>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-context"
        title="See the whole relationship"
        description="Keep emails, calls, files, and tasks on the customer record."
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmRecordDemo />
        </DemoInteractionBoundary>
        <ProductProse>
          <p>
            Open a company to see its contacts and related work. Add notes to
            the record so your team can find them later.
          </p>
        </ProductProse>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-agents"
        title="Keep deals moving"
        description="Ask an agent to update your pipeline after a sales call."
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
        <ProductProse>
          <p>
            Agents can read customer records and update their properties from
            Macro or a connected MCP client.
          </p>
        </ProductProse>
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
