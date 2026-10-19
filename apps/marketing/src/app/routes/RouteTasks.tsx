import jacobPhoto from '../../assets/people/jacob.webp';
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
import { TaskContextDemo } from '../../features/marketing/components/tasks/TaskContextDemo';
import { TaskHeroDemo } from '../../features/marketing/components/tasks/TaskProjectView';
import {
  TaskAgentChannelDemo,
  TaskFromMessageDemo,
  TaskGithubDemo,
} from '../../features/marketing/components/tasks/TaskStories';
import { TasksComparison } from '../../features/marketing/components/tasks/TasksComparison';
import { DEMO_BOOKING_URL } from '../../features/marketing/core/navigation';
import '../../features/marketing/components/tasks/tasks-page.css';
import { setPageSeo } from '../utils/utilSeo';

const tasksFaq = [
  {
    q: 'How do I see my work and the tasks I’ve assigned?',
    a: 'My Tasks shows your assignments. Created by me shows the work you’ve asked for, and All Tasks shows tasks you can access. Filter by owner, status, or priority. New assignments also arrive in Home alongside your email and messages.',
  },
  {
    q: 'What updates automatically?',
    a: (
      <>
        Task mentions reflect the task’s current title and status. People update
        progress directly, or ask an agent to do it. For engineering work,
        linked GitHub pull requests move tasks into review and mark them
        completed when merged. <a href="/github">See the GitHub integration</a>.
      </>
    ),
  },
  {
    q: 'Can an agent take on a task?',
    a: (
      <>
        Yes. Assign an available agent to a task to start an agent session. Open
        that session from the task to follow its work. You can also ask @Macro
        to create tasks, change assignments, or find what’s still open.{' '}
        <a href="/agents">Explore agents in Macro</a>.
      </>
    ),
  },
  {
    q: 'Can we bring our existing tasks?',
    a: (
      <>
        You can import Linear issues or task CSVs. The route depends on what
        you’re bringing from your current tool.{' '}
        <a href="/migrate">See your migration options</a> or{' '}
        <a href={DEMO_BOOKING_URL}>talk to our team</a> about moving your
        company.
      </>
    ),
  },
  {
    q: 'Who can see our tasks?',
    a: 'Tasks follow your sharing settings. The task composer lets you share with your team or keep a task private to you and the people you share it with. Macro’s code is open source; your company’s work is not public.',
  },
  {
    q: 'Can I get started for free?',
    a: (
      <>
        Yes. Start with a free personal account. See{' '}
        <a href="/pricing">pricing</a> for company plans and current limits.
      </>
    ),
  },
];

export function RouteTasks() {
  setPageSeo({
    title: 'Macro Tasks — Task management that keeps up with your team',
    description:
      'Turn requests in chat, email, and docs into assigned tasks. Keep the source attached, follow progress, and get work done with your team and agents.',
    path: '/tasks',
  });
  return (
    <ProductPage>
      <div class="tasks-page">
        <ProductHero
          cta="tasks_hero_get_started"
          product="Tasks"
          title={['Task tracking without', 'the busywork.']}
          description="What task tracking was meant to be."
        />
        <TaskHeroDemo />
        <section
          class="tasks-founder-letter"
          aria-labelledby="tasks-founder-title"
        >
          <a
            class="tasks-founder-card"
            href="/posts/linear-alternative"
            aria-label="Read Jacob’s story: Macro vs. Linear"
          >
            <div class="tasks-founder-card-body">
              <h2 id="tasks-founder-title">Why we built Macro Tasks.</h2>
              <blockquote>
                “Tracking tasks felt like busywork to our team.”
              </blockquote>
              <div class="tasks-founder-person">
                <img
                  src={jacobPhoto}
                  alt="Jacob"
                  width="52"
                  height="52"
                  loading="lazy"
                />
                <div>
                  <strong>Jacob</strong>
                  <span>CEO and founder of Macro</span>
                </div>
              </div>
            </div>
            <div class="tasks-founder-card-article">
              <span>Macro vs. Linear</span>
              <span>
                Read the story <span aria-hidden="true">→</span>
              </span>
            </div>
          </a>
        </section>
        <FeaturePageSection
          id="from-a-message"
          title={['Turn requests', 'into tasks']}
          description="Turn a request in chat into a task without copying it into another tool. Give it an owner, set the priority, and keep the original conversation close by."
          details={[
            {
              title: 'Capture the request',
              text: 'Use the Task action on the message that contains the request. The task links back to the conversation, so its owner can read the original wording and the replies around it.',
            },
            {
              title: 'Choose an owner',
              text: 'Assign the person responsible for the next step and set a priority. The task gives the request a clear owner and a place to track its progress.',
            },
            {
              title: 'Add the missing details',
              text: 'Open the task to add a description, checklist, or linked brief. Keep the original request as context while making the next step specific enough to act on.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskFromMessageDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="ask-macro"
          title={['Let agents', 'handle updates']}
          description="Tell your agent what needs doing in the conversation where you’re already working. It can create tasks, change an assignment, and check what’s still open for the team."
          details={[
            {
              title: 'Create several tasks',
              text: 'Ask Macro to split the proposal into tasks and name the owners in the same message. Drafting the proposal and reviewing the pricing become separate assignments, each with its own owner.',
            },
            {
              title: 'Reassign in chat',
              text: 'When Julia takes over the draft, tell Macro in the channel. It updates the shared task’s assignee, so the change reaches the task itself as well as the people reading the conversation.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskAgentChannelDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="from-docs-and-email"
          title={['Keep the context', 'with the task']}
          description="A task should include the information someone needs to do it. Link the brief, the customer email, or the team discussion directly in its description and open the source when you need it."
          details={[
            {
              title: 'Reference the customer email',
              text: 'Mention the original email in the task description. The person doing the work can read the request and its attachments without relying on a pasted summary.',
            },
            {
              title: 'Open the brief beside the task',
              text: 'Follow a document mention to read the brief while working on the task. The link opens the original document, so later edits stay available.',
            },
            {
              title: 'Find the discussion',
              text: 'Link the conversation where the decision was made. A new assignee can catch up on the reasoning and follow-up questions before starting.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskContextDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="github"
          title={['Merge code.', 'Close the task.']}
          description="Connect a task to its pull request and let the code update its status. The task moves into review when the PR opens and completes when the change merges."
          details={[
            {
              title: 'Link by task ID',
              text: 'Put the task ID in the branch name, pull request title, or description. Macro uses it to connect the implementation to the task.',
            },
            {
              title: 'Move through review',
              text: 'Opening the linked pull request moves the task to In Review. Merging it marks the task Completed. Closing without a merge returns it to Not Started.',
            },
          ]}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskGithubDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <TasksComparison />
        <FeaturePageFaq
          id="tasks-faq-title"
          title="Questions about Macro Tasks"
          items={tasksFaq}
        />
        <HomepageClosing />
      </div>
    </ProductPage>
  );
}
