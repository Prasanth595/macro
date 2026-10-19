import { setPageSeo } from '../../../app/utils/utilSeo';
import {
  CallFollowupDemo,
  CallHeroDemo,
  CallStartDemo,
} from '../components/calls/CallStories';
import { CallsComparison } from '../components/calls/CallsComparison';
import { CallTeamMemoryDemo } from '../components/calls/CallTeamMemoryDemo';
import { FeaturePageFaq, FeaturePageSection } from '../components/FeaturePage';
import { HomepageClosing } from '../components/HomepageClosing';
import {
  CallGraphic,
  ContextGraphic,
  LinkedWorkGraphic,
} from '../components/product/ProductGraphics';
import { ProductHero, ProductPage } from '../components/product/ProductPage';
import { callsGuides } from '../content/feature-guides/calls';
import './calls-page.css';

const callsFaq = [
  {
    q: 'Can I bring my Granola transcripts into Macro?',
    a: 'Yes. Bring your Granola transcripts into Macro so your agents can use them alongside your tasks, docs, and email. You can keep using Granola with your current meeting app.',
  },
  {
    q: 'Are calls recorded automatically?',
    a: 'Yes. Macro records, transcribes, and summarizes calls. Participants see a recording and transcription notice.',
  },
  {
    q: 'Who can access the recording and transcript?',
    a: 'The organizer and signed-in participants have access to the saved call. Additional access depends on the call’s sharing settings. Agents can only read calls you have access to.',
  },
  {
    q: 'Can guests join without a Macro account?',
    a: 'Yes. Share a link to an instant or scheduled meeting and guests can join in their browser without creating an account.',
  },
  {
    q: 'Are calls included in the free plan?',
    a: (
      <>
        Calls, recording, and transcription are included in the paid plan. See{' '}
        <a href="/pricing">pricing</a> for details.
      </>
    ),
  },
];

export function RouteCalls() {
  // Repeated clicks on the same hash still need to revisit the section.
  const revisitSection = (
    event: MouseEvent & { currentTarget: HTMLAnchorElement }
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const hash = event.currentTarget.hash;
    if (hash !== window.location.hash) return;
    event.preventDefault();
    document.getElementById(hash.slice(1))?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };
  setPageSeo({
    title: 'Macro Calls — Turn Conversations into Tasks and Updates',
    description:
      'Macro records and transcribes your calls so your agents can update tasks and docs from the conversation.',
    path: '/calls',
  });
  return (
    <ProductPage>
      <div class="calls-page">
        <ProductHero
          cta="calls_hero_get_started"
          product="Calls"
          title={['Turn your conversations into', 'tasks and updates.']}
          description={[
            'Macro records and transcribes your calls.',
            'Ask your agent to handle the follow-up.',
          ]}
        />
        <CallHeroDemo />
        <nav class="feature-page-jump-links" aria-label="On this page">
          <a href="#call-start" onClick={revisitSection}>
            <CallGraphic />
            <span>Meet in a click</span>
          </a>
          <a href="#call-followup" onClick={revisitSection}>
            <LinkedWorkGraphic />
            <span>Act on decisions</span>
          </a>
          <a href="#call-default" onClick={revisitSection}>
            <ContextGraphic />
            <span>Catch up afterward</span>
          </a>
        </nav>
        <FeaturePageSection
          id="call-start"
          title={['Meet in', 'a click']}
          description="Start a call from a channel or direct message when talking is easier than typing. Your teammates can join from the conversation, and you can share a meeting link with someone outside Macro."
          details={callsGuides['call-start']}
        >
          <div class="feature-page-visual">
            <CallStartDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="call-followup"
          title={['Turn decisions', 'into action']}
          description="Make the decisions from a call part of the work that follows. Ask your agent to read the transcript, update a task, and add the owner and next steps you agreed on."
          details={callsGuides['call-followup']}
        >
          <div class="feature-page-visual">
            <CallFollowupDemo />
          </div>
        </FeaturePageSection>
        <FeaturePageSection
          id="call-default"
          title={['Catch up', 'after the call']}
          description="Give teammates a way to catch up even if they missed the meeting. Share the call’s recording, transcript, and summary so they can find the decisions and revisit the details."
          details={callsGuides['call-default']}
        >
          <div class="feature-page-visual">
            <CallTeamMemoryDemo />
          </div>
        </FeaturePageSection>
        <CallsComparison />
        <FeaturePageFaq
          id="calls-faq-title"
          title="Questions about Macro Calls"
          items={callsFaq}
        />
        <HomepageClosing />
      </div>
    </ProductPage>
  );
}
