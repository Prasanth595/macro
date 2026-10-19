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
import { tasksGuides } from '../../features/marketing/content/feature-guides/tasks';
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
        Yes. See <a href="/pricing">pricing</a> for company plans and current
        limits.
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
          description="Connect your tasks to the work."
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
          details={tasksGuides['from-a-message']}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskFromMessageDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="ask-macro"
          title={['Let agents', 'handle updates']}
          description="Tell your agent what your team needs to get done in the channel your team already talks in. The agent can create tasks, change who’s assigned, and check what tasks are still incomplete."
          details={tasksGuides['ask-macro']}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskAgentChannelDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="from-docs-and-email"
          title={['Tag files, people,', 'and emails to your task']}
          description="Tag emails, documents, images, and team discussion directly to your task so your team has the context it needs to complete the task."
          details={tasksGuides['from-docs-and-email']}
        >
          <DemoInteractionBoundary class="feature-page-visual">
            <TaskContextDemo />
          </DemoInteractionBoundary>
        </FeaturePageSection>
        <FeaturePageSection
          id="github"
          title={['Merge code.', 'Close the task.']}
          description="Connect a task to its pull request and let the code update its status. The task moves into review when the PR opens and completes when the change merges."
          details={tasksGuides['github']}
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
