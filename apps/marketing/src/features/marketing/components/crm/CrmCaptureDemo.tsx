import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { WorkspaceComment } from '../../core/dummy-workspace';
import type { SampleCompany } from '../../core/workspace-fixtures';
import { createCrmDemoWorkspace } from '../../primitives/createCrmDemoWorkspace';
import { createProductWalkthrough } from '../../primitives/createProductWalkthrough';
import { ProductDemo } from '../product/ProductPage';
import { CompanyPipelineEntry } from './CompanyPipelineEntry';
import { CrmRecordWorkspace } from './CrmRecordWorkspace';

const request: WorkspaceComment = {
  id: 'capture-request',
  person: 'jacob',
  body: '@[Claude](demo-mention:claude) just got off a call with Ava. They want a demo Thursday at 9 for the studio team. Move Parlor Studio to Demo, make me the owner, and note that Alex is running the rollout on their side.',
  time: '9:51 AM',
};
const reply: WorkspaceComment = {
  id: 'capture-reply',
  person: 'claude',
  body: 'Done. Parlor Studio is in Demo and you’re the owner. From the call: demo Thursday at 9 with the studio team, and Alex (alex@parlorstudio.example) is running the rollout on their side.',
  time: '9:52 AM',
  replyTo: 'capture-request',
};

/**
 * @Claude in a company's Discussion: the agent sets Stage and Owner through
 * the property tools and answers in the thread. Phases: 0 request, 1 Stage,
 * 2 Stage set, 3 Owner, 4 Owner set, 5 thread, 6 reply.
 */
export function CrmCaptureDemo() {
  let frame!: HTMLDivElement;
  const w = createCrmDemoWorkspace();
  const meadow = (patch: Partial<SampleCompany>) =>
    w.setData('companies', (company) => company.id === 'meadow', patch);
  meadow({ comments: [request] });
  const [deal, setDeal] = createStore<
    Pick<SampleCompany, 'stage' | 'owner' | 'revenue'>
  >({ stage: 'Lead', owner: '', revenue: '18000' });
  w.open('crm', 'meadow');
  const [phase, setPhase] = createSignal(0);
  const finish = () => {
    setDeal({ stage: 'Demo', owner: 'jacob' });
    meadow({ comments: [request, reply] });
    setPhase(6);
  };
  const playback = createProductWalkthrough({
    root: () => frame,
    steps: 6,
    reset: () => {},
    reduced: () => {
      finish();
    },
    delay: (step) => [0, 900, 900, 1000, 900, 1000, 900][step] ?? 1000,
    advance: (step) => {
      if (step === 2) setDeal({ stage: 'Demo' });
      if (step === 4) setDeal({ owner: 'jacob' });
      if (step === 6) {
        finish();
        // Like a chat, the record scrolls to the new reply when it lands
        // below the fold (or under the phone's details sheet).
        requestAnimationFrame(() => {
          const scroll = frame.querySelector('.sample-company-scroll');
          scroll?.scrollTo?.({ top: scroll.scrollHeight, behavior: 'smooth' });
        });
      } else setPhase(step);
    },
  });
  const pause = () => {
    playback.pause();
  };
  const action = () =>
    phase() === 1 || phase() === 2
      ? 'stage'
      : phase() === 3 || phase() === 4
        ? 'owner'
        : undefined;
  return (
    <div ref={frame} class="crm-demo-frame" onFocusIn={pause}>
      <ProductDemo
        label="Claude updates Parlor Studio from a comment in its Discussion"
        onInteract={pause}
        action={action()}
        height={600}
        mobileHeight={700}
      >
        <CrmRecordWorkspace
          workspace={w}
          pipeline={<CompanyPipelineEntry value={deal} onChange={setDeal} />}
        />
      </ProductDemo>
    </div>
  );
}
