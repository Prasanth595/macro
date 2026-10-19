import { DemoMention } from '../DemoMention';
import { HomepageConversation } from '../HomepageConversation';
import HomepageEmailCompose from '../HomepageEmailCompose';
import { HomepageMention } from '../HomepageMention';
import './email-agentic-editing.css';

/** The homepage conversation and editable draft, kept local to this demo. */
export function EmailAgenticEditingDemo() {
  return (
    <div class="email-editing-stage">
      <HomepageConversation
        messages={[
          {
            person: 'julia',
            text: 'Can you send Valentina the demo follow-up?',
          },
          {
            person: 'jacob',
            text: (
              <>
                <DemoMention
                  item={{ id: 'macro', label: 'Macro', kind: 'person' }}
                />{' '}
                draft Valentina’s follow-up from{' '}
                <HomepageMention
                  kind="call"
                  label="Demo call transcript"
                  description="The demo with Valentina: team rollout, sales materials, and next steps."
                  href="#agentic-editing"
                />
                . Link the sales PDF and rollout plan. Cc Julia.
              </>
            ),
          },
        ]}
      />
      <HomepageEmailCompose appChrome />
    </div>
  );
}
