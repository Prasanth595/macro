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
import {
  ProductHero,
  ProductPage,
} from '../../features/marketing/components/product/ProductPage';
import { WorkspaceDesktopDemo } from '../../features/marketing/components/WorkspaceDesktopDemo';
import { crmGuides } from '../../features/marketing/content/feature-guides/crm';
import { setPageSeo } from '../utils/utilSeo';
import '../../features/marketing/components/crm/crm-page.css';
import '../../features/marketing/components/homepage-pipeline-demo.css';

const loadPipeline = () =>
  import('../../features/marketing/components/homepage/CrmPipelineScene');
const PipelineDemo = lazy(loadPipeline);
const loadFollowup = async () => ({
  default: (
    await import('../../features/marketing/components/crm/CrmFollowupDemo')
  ).CrmFollowupDemo,
});
const FollowupDemo = lazy(loadFollowup);

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
        title={['The CRM connected', 'to your team’s work.']}
        description={[
          'Agents update customer records',
          'from emails, calls, chats, and tasks.',
        ]}
        cta="crm_hero_get_started"
      />
      <WorkspaceDesktopDemo
        heroFrame
        windowChrome={false}
        view="crm"
        label="Explore Macro CRM"
      >
        <DeferredDemo
          preload={loadPipeline}
          fallback={<DemoPlaceholder label="Sales pipeline" />}
        >
          <PipelineDemo hero />
        </DeferredDemo>
      </WorkspaceDesktopDemo>
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
        title={['Keep your CRM', 'up to date with agents.']}
        description="Your agent can read customer emails, calls, and chats, then update stages, owners, and next steps in your CRM."
        details={crmGuides['crm-from-email']}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmCaptureDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-enrichment"
        title={['Automatically add and', 'enrich new contacts.']}
        description="When you email someone new, Macro creates the contact and company from their domain. Public company details fill in the record, so you have a starting point before the first meeting."
        details={crmGuides['crm-enrichment']}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmEnrichmentDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-context"
        title={['Connect calls, emails, and', 'tasks to each customer.']}
        description="Open a company to see the people, emails, calls, files, and tasks behind the relationship. Keep notes on the record so your team understands what happened and what comes next."
        details={crmGuides['crm-context']}
      >
        <DemoInteractionBoundary class="feature-page-visual">
          <CrmRecordDemo />
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <FeaturePageSection
        id="crm-agents"
        title={['Draft follow-ups and plan', 'next steps with your agent.']}
        description="Your agent can read the full customer relationship across emails, calls, chats, files, tasks, and GitHub pull requests. Use that context to draft better follow-up emails and move deals forward."
        details={crmGuides['crm-agents']}
      >
        <DemoInteractionBoundary class="feature-page-visual crm-agent-scene">
          <DeferredDemo
            preload={loadFollowup}
            fallback={<DemoPlaceholder label="Customer follow-up" />}
          >
            <FollowupDemo />
          </DeferredDemo>
        </DemoInteractionBoundary>
      </FeaturePageSection>
      <CrmComparison />
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
      <HomepageClosing />
    </ProductPage>
  );
}
