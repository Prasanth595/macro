import { setPageSeo } from '../../../app/utils/utilSeo';
import { FeaturePageFaq, FeaturePageSection } from '../components/FeaturePage';
import { HomepageClosing } from '../components/HomepageClosing';
import {
  ContextGraphic,
  EditingGraphic,
  LinkedWorkGraphic,
  ThreadGraphic,
} from '../components/product/ProductGraphics';
import { ProductHero, ProductPage } from '../components/product/ProductPage';
import {
  GithubConversationDemo,
  GithubPrHero,
  GithubTaskDemo,
} from '../components/reviews/GithubWorkflow';
import { ReviewInboxDemo } from '../components/reviews/ReviewStories';
import { WorkspaceDesktopDemo } from '../components/WorkspaceDesktopDemo';
import { githubGuides } from '../content/feature-guides/github';

const githubFaq = [
  {
    q: 'How do I connect GitHub?',
    a: 'Link your GitHub account in Settings under Account.',
  },
  {
    q: 'What stays on GitHub?',
    a: 'Your repositories, branches, CI, and repository permissions stay on GitHub. Macro brings pull requests, code changes, and review discussions into your workspace. Submit approvals and review comments on GitHub.',
  },
  {
    q: 'How do pull requests link to tasks?',
    a: (
      <>
        Include the task ID in the branch name, PR title, or description.
        Opening the PR moves the linked task to In Review. Merging it marks the
        task Completed. Closing it without merging returns the task to Not
        Started. <a href="/tasks">More about tasks</a>.
      </>
    ),
  },
  {
    q: 'Can I merge a pull request in Macro?',
    a: 'Yes. Open the PR and choose Merge. You confirm before it merges, and GitHub applies your repository permissions and merge requirements.',
  },
  {
    q: 'Which coding agents can I use?',
    a: (
      <>
        Bring coding agents such as Cursor or Claude Code into your channels.{' '}
        <a href="/agents">See how to connect your agents</a>.
      </>
    ),
  },
  {
    q: 'Is there a free plan?',
    a: (
      <>
        Yes. See <a href="/pricing">pricing</a> for current limits.
      </>
    ),
  },
];

export function RouteGithub() {
  setPageSeo({
    title: 'GitHub in Macro | Pull Requests, Code Changes, and Tasks',
    description:
      'Open GitHub pull requests from chat, inspect code changes, and keep linked tasks in sync. Work with coding agents and see review requests in your inbox.',
    path: '/github',
  });
  return (
    <ProductPage>
      <div class="github-page">
        <ProductHero
          product="for GitHub"
          title={['Review code without', 'leaving Macro.']}
          description={[
            'Read the discussion, inspect code changes,',
            'and keep linked tasks up to date.',
          ]}
          cta="github_hero_get_started"
        />
        <WorkspaceDesktopDemo
          heroFrame
          view="home"
          label="Explore GitHub in Macro"
        >
          <GithubPrHero />
        </WorkspaceDesktopDemo>
        <nav class="feature-page-jump-links" aria-label="On this page">
          <a href="#pr-links">
            <ContextGraphic />
            <span>Pull requests in chat</span>
          </a>
          <a href="#pr-tasks">
            <LinkedWorkGraphic />
            <span>Linked tasks</span>
          </a>
          <a href="#coding-agents">
            <EditingGraphic />
            <span>Coding agents</span>
          </a>
          <a href="#review-inbox">
            <ThreadGraphic />
            <span>Review requests</span>
          </a>
        </nav>
        <FeaturePageSection
          id="pr-links"
          title={['Review pull requests', 'without leaving chat.']}
          description="Share a GitHub pull request in chat and open it from the conversation. Read the discussion and inspect the code changes while the linked PR’s status stays up to date."
          details={githubGuides['pr-links']}
        >
          <div class="feature-page-visual">
            <GithubConversationDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="pr-tasks"
          title={['Link pull requests', 'to tasks.']}
          description="Keep implementation and task tracking connected. Link a pull request to its task, then let opening, merging, or closing the PR update the task’s status."
          details={githubGuides['pr-tasks']}
        >
          <div class="feature-page-visual">
            <GithubTaskDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="coding-agents"
          title={['Ask an agent', 'to fix bugs.']}
          description="Ask your coding agent to fix a bug as it comes up in your team conversations. It’ll see what was said and understand your request, then put up a PR."
          details={githubGuides['coding-agents']}
        >
          <div class="feature-page-visual">
            <GithubConversationDemo agent />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="review-inbox"
          title={['See review requests', 'in one inbox.']}
          description="Find GitHub mentions, comments, and requested reviews alongside the rest of your work."
          details={githubGuides['review-inbox']}
        >
          <div class="feature-page-visual">
            <ReviewInboxDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageFaq
          id="github-faq"
          title="Frequently asked questions"
          items={githubFaq}
        />
      </div>
      <HomepageClosing />
    </ProductPage>
  );
}
