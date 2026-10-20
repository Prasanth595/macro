import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { SampleCompany } from '../../core/workspace-fixtures';
import { createCrmDemoWorkspace } from '../../primitives/createCrmDemoWorkspace';
import { createDemoPointer } from '../../primitives/createDemoPointer';
import { createProductWalkthrough } from '../../primitives/createProductWalkthrough';
import { DemoCursor } from '../DemoCursor';
import { ProductDemo } from '../product/ProductPage';
import type { CompanySection } from '../workspace/WorkspaceCompanies';
import { CompanyPipelineEntry } from './CompanyPipelineEntry';
import { CrmRecordWorkspace } from './CrmRecordWorkspace';

/** Tab the walkthrough points at, then opens, for each step. */
const tour: (CompanySection | undefined)[] = [
  undefined,
  'emails',
  'emails',
  'calls',
  'calls',
  'overview',
  'overview',
];

/** Parlor Studio's record: Emails, then Calls, then back to the Discussion. */
export function CrmRecordDemo() {
  let frame!: HTMLDivElement;
  const w = createCrmDemoWorkspace();
  w.open('crm', 'meadow');
  const [deal, setDeal] = createStore<
    Pick<SampleCompany, 'stage' | 'owner' | 'revenue'>
  >({ stage: 'Demo', owner: 'jacob', revenue: '18000' });
  const [section, setSection] = createSignal<CompanySection>('overview');
  const [phase, setPhase] = createSignal(0);
  const [automatic, setAutomatic] = createSignal(true);
  const playback = createProductWalkthrough({
    root: () => frame,
    steps: 6,
    loop: { hold: 6500 },
    reset: () => {
      setPhase(0);
      setSection('overview');
      setAutomatic(true);
      const scroll = frame.querySelector('.sample-company-scroll');
      if (scroll) scroll.scrollTop = 0;
    },
    reduced: () => {
      setAutomatic(false);
      setSection('overview');
    },
    delay: (step) => (step === 1 ? 900 : step % 2 ? 1500 : 500),
    advance: (step) => {
      setPhase(step);
      const tab = tour[step];
      if (step % 2 === 0 && tab) setSection(tab);
      if (step === 6) {
        setAutomatic(false);
        // Back on Overview, bring the team's thread into view.
        requestAnimationFrame(() => {
          const scroll = frame.querySelector('.sample-company-scroll');
          scroll?.scrollTo?.({ top: scroll.scrollHeight, behavior: 'smooth' });
        });
      }
    },
  });
  const pause = () => {
    setAutomatic(false);
    playback.pause();
  };
  const pointer = createDemoPointer({
    frame: () => frame,
    active: automatic,
    target: () => {
      const tab = tour[phase()];
      return tab ? `[data-record-tab="${tab}"]` : undefined;
    },
  });
  return (
    <div ref={frame} class="crm-demo-frame" onFocusIn={pause}>
      <ProductDemo
        label="Parlor Studio’s emails, calls, and team discussion in one record"
        onInteract={pause}
        height={520}
        mobileHeight={600}
      >
        <CrmRecordWorkspace
          workspace={w}
          pipeline={<CompanyPipelineEntry value={deal} onChange={setDeal} />}
          section={section()}
          onSectionChange={setSection}
        />
      </ProductDemo>
      <Show when={automatic() && pointer()}>
        {(p) => (
          <DemoCursor
            class="crm-demo-pointer"
            clicking={phase() % 2 === 0}
            style={{ transform: `translate(${p().x}px, ${p().y}px)` }}
          />
        )}
      </Show>
    </div>
  );
}
