import Envelope from '@phosphor/envelope.svg';
import Hash from '@phosphor/hash.svg';
import { DemoMention } from '../DemoMention';
import { HomepageConversation } from '../HomepageConversation';
import HomepageEmailCompose from '../HomepageEmailCompose';
import { HomepageMention } from '../HomepageMention';
import { EmailShell } from './frozen/EmailShell';
import './email-feature-demos.css';
import './email-agentic-editing.css';

/** The homepage conversation and editable draft, kept local to this demo. */
export function EmailAgenticEditingDemo() {
  return (
    <div class="email-editing-stage email-feature-demo">
      <EmailShell label="Draft an email from a conversation" showRail={false}>
        <div class="email-editing-panes">
          <section
            class="email-editing-conversation"
            aria-label="Launch conversation"
          >
            <header class="email-feature-toolbar">
              <Hash class="size-4" />
              <span>launch</span>
            </header>
            <div class="email-editing-messages">
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
            </div>
          </section>
          <section class="email-editing-draft" aria-label="Email draft">
            <header class="email-feature-toolbar">
              <Envelope class="size-4" />
              <span>New email</span>
            </header>
            <div class="email-editing-compose">
              <HomepageEmailCompose appChrome />
            </div>
          </section>
        </div>
      </EmailShell>
    </div>
  );
}
