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
          title={['Open pull requests', 'right in Macro.']}
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
          title={['See the code', 'behind the chat']}
          description="Share a GitHub pull request in chat and open it from the conversation. Read the discussion and inspect the code changes while the linked PR’s status stays up to date."
          details={[
            {
              title: 'Share the pull request',
              summary: 'Keep the pull request linked to the team discussion.',
              text: 'Paste the PR into the team conversation. Its reference stays linked to the pull request and reflects its current status.',
            },
            {
              title: 'Read the diff',
              summary: 'Inspect the code changes directly in Macro.',
              text: 'Open the PR in Macro to inspect the code changes alongside the discussion. Your repository, CI, and permissions remain on GitHub.',
            },
            {
              title: 'Merge in Macro',
              summary:
                'Confirm the merge with GitHub’s requirements still applied.',
              text: 'Use Merge on the pull request and confirm the action. GitHub still applies the repository’s permissions and merge requirements.',
            },
          ]}
        >
          <div class="feature-page-visual">
            <GithubConversationDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="pr-tasks"
          title={['Keep tasks', 'in sync with code']}
          description="Keep implementation and task tracking connected. Link a pull request to its task, then let opening, merging, or closing the PR update the task’s status for the team."
          details={[
            {
              title: 'Link the task ID',
              summary: 'Connect the implementation to the work it completes.',
              text: 'Put the task ID in the branch name, PR title, or description to connect the task and implementation.',
            },
            {
              title: 'Open a PR',
              summary: 'Move the linked task into review automatically.',
              text: 'When the linked pull request opens, the task moves to In Review so the team can see that implementation is ready for review.',
            },
            {
              title: 'Merge the change',
              summary: 'Mark the task completed when the PR merges.',
              text: 'Merging the linked PR marks the task Completed. The status follows the code change instead of waiting for someone to update it manually.',
            },
            {
              title: 'Close without merging',
              summary: 'Return the task to Not Started if the PR is closed.',
              text: 'If the pull request is closed without a merge, the linked task returns to Not Started. The task does not appear finished when the change did not ship.',
            },
          ]}
        >
          <div class="feature-page-visual">
            <GithubTaskDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="coding-agents"
          title={['Turn bug reports', 'into fixes']}
          description="Ask a connected coding agent to pick up a bug from the team conversation. Give it the context, then open its pull request in Macro to understand the changes and discuss the result."
          details={[
            {
              title: 'Assign the bug to Cursor',
              summary:
                'Give your coding agent the problem in the team conversation.',
              text: 'Tag Cursor in the conversation with the problem and the context it needs. The team can follow the request where the bug was reported.',
            },
            {
              title: 'Inspect the pull request',
              summary: 'Read the agent’s changes and review the result.',
              text: 'Open the agent’s PR to read its changes and the discussion. Submit approvals and review comments on GitHub using your existing repository permissions.',
            },
          ]}
        >
          <div class="feature-page-visual">
            <GithubConversationDemo agent />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="review-inbox"
          title={['Know what needs', 'your review']}
          description="Keep GitHub review requests, comments, and mentions alongside your messages, tasks, and email. See what needs attention and open the relevant pull request from the same inbox."
          details={[
            {
              title: 'Review requests',
              summary: 'Find the pull requests waiting for your review.',
              text: 'See pull requests waiting for your review alongside your other work. Open the request to inspect the PR and understand what changed.',
            },
            {
              title: 'Comments and mentions',
              summary: 'See when a teammate needs your input on a PR.',
              text: 'Find GitHub comments and mentions in the same inbox. Open the relevant pull request when a teammate needs your input.',
            },
            {
              title: 'One inbox for the follow-up',
              summary:
                'Keep review requests alongside messages, tasks, and email.',
              text: 'Keep the review request beside the messages, tasks, and emails that may explain it. You can follow the work without keeping a separate notification stream open.',
            },
          ]}
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
