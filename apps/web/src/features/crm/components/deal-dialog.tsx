import { toast } from '@core/component/Toast/Toast';
import { fireAndForget } from '@core/util/fireAndForget';
import BuildingsIcon from '@phosphor/buildings.svg';
import UsersIcon from '@phosphor/users.svg';
import XIcon from '@phosphor/x.svg';
import { storageServiceClient } from '@service-storage/client';
import { Button, badgeClasses, Dialog, EntityComposer, Panel } from '@ui';
import {
  type Component,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { fetchCrmExportCompanies } from '../queries/export';

type Linked = { id: string; label: string };

/** Name a deal and the companies and people it involves, then hand it back. */
export function DealDialog(props: {
  onCreate(deal: { id: string; name: string }): Promise<void>;
  onClose(): void;
}) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [companyQuery, setCompanyQuery] = createSignal('');
  const [contactQuery, setContactQuery] = createSignal('');
  const [companies, setCompanies] = createSignal<Linked[]>([]);
  const [contacts, setContacts] = createSignal<Linked[]>([]);
  const [companyChoices, setCompanyChoices] = createSignal<Linked[]>([]);
  const [contactChoices, setContactChoices] = createSignal<Linked[]>([]);
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal('');
  let contactTimer: number | undefined;
  const close = () => !pending() && props.onClose();
  const chosenCompany = (id: string) =>
    companies().some((item) => item.id === id);
  const chosenContact = (id: string) =>
    contacts().some((item) => item.id === id);
  const visibleCompanies = () => {
    const query = companyQuery().trim().toLowerCase();
    return companyChoices()
      .filter((company) => !chosenCompany(company.id))
      .filter(
        (company) => !query || company.label.toLowerCase().includes(query)
      )
      .slice(0, 8);
  };

  onMount(() => {
    const controller = new AbortController();
    fireAndForget(loadCompanies(controller.signal), 'crm.deal-dialog');
    onCleanup(() => controller.abort());
  });

  async function loadCompanies(signal: AbortSignal) {
    try {
      const loaded = await fetchCrmExportCompanies(
        storageServiceClient,
        signal,
        () => {}
      );
      setCompanyChoices(
        loaded.map((company) => ({
          id: company.id,
          label: company.name || company.domains[0]?.domain || 'Company',
        }))
      );
    } catch {
      // A closed dialog aborts the request.
    }
  }

  function searchContacts(query: string) {
    window.clearTimeout(contactTimer);
    if (query.trim().length < 2) {
      setContactChoices([]);
      return;
    }
    contactTimer = window.setTimeout(() => {
      fireAndForget(loadContacts(query.trim()), 'crm.deal-dialog');
    }, 200);
  }

  async function loadContacts(query: string) {
    const result = await storageServiceClient.searchContacts({
      query,
      limit: 8,
    });
    if (result.isErr()) return;
    setContactChoices(
      result.value.contacts.map((contact) => ({
        id: contact.id,
        label: contact.name || contact.email,
      }))
    );
  }

  async function submit() {
    if (pending() || !name().trim()) return;
    setPending(true);
    setError('');
    const created = await storageServiceClient.createDeal({
      name: name().trim(),
      description: description().trim(),
      companyIds: companies().map((company) => company.id),
      contactIds: contacts().map((contact) => contact.id),
    });
    if (created.isErr()) {
      setError('Could not create this deal. Please try again.');
      setPending(false);
      return;
    }
    try {
      await props.onCreate(created.value);
      props.onClose();
    } catch {
      toast.failure(
        'The deal was created, but it could not be added to the board.'
      );
      props.onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <Panel hideBorder class="bg-transparent rounded-[inherit] *:max-h-[75vh]">
        <Panel.Body>
          <form
            class="h-full min-h-0"
            aria-label="New deal"
            onSubmit={(event) => {
              event.preventDefault();
              fireAndForget(submit(), 'crm.deal-dialog');
            }}
          >
            <EntityComposer.Root>
              <EntityComposer.Header>
                <Dialog.Title class="sr-only">New deal</Dialog.Title>
                <EntityComposer.Title class="mb-0 min-w-0 flex-1 self-center">
                  <input
                    autofocus
                    aria-label="Deal name"
                    placeholder="Deal name"
                    maxlength={200}
                    required
                    class="ph-no-capture w-full min-w-0 text-xl/7 font-medium outline-none bg-transparent placeholder:text-ink-placeholder"
                    value={name()}
                    disabled={pending()}
                    onInput={(event) => setName(event.currentTarget.value)}
                  />
                </EntityComposer.Title>
                <Button
                  tabIndex={-1}
                  aria-label="Close"
                  tooltip="Close"
                  size="icon-composer"
                  disabled={pending()}
                  onClick={close}
                >
                  <XIcon />
                </Button>
              </EntityComposer.Header>
              <EntityComposer.Main class="gap-4 px-2">
                <textarea
                  aria-label="Deal description"
                  placeholder="What this deal is"
                  maxlength={4000}
                  rows={3}
                  disabled={pending()}
                  class="w-full resize-none rounded-lg border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-placeholder"
                  value={description()}
                  onInput={(event) => setDescription(event.currentTarget.value)}
                />
                <LinkPicker
                  disabled={pending()}
                  legend="Companies"
                  icon={BuildingsIcon}
                  query={companyQuery()}
                  queryLabel="Find a company"
                  placeholder="Find a company"
                  chosen={companies()}
                  choices={visibleCompanies()}
                  onQuery={setCompanyQuery}
                  onAdd={(company) => {
                    setCompanies((current) => [...current, company]);
                    setCompanyQuery('');
                  }}
                  onRemove={(id) =>
                    setCompanies((current) =>
                      current.filter((item) => item.id !== id)
                    )
                  }
                />
                <LinkPicker
                  disabled={pending()}
                  legend="People"
                  icon={UsersIcon}
                  query={contactQuery()}
                  queryLabel="Find a person"
                  placeholder="Find a person"
                  chosen={contacts()}
                  choices={contactChoices().filter(
                    (contact) => !chosenContact(contact.id)
                  )}
                  onQuery={(value) => {
                    setContactQuery(value);
                    searchContacts(value);
                  }}
                  onAdd={(contact) => {
                    setContacts((current) => [...current, contact]);
                    setContactQuery('');
                    setContactChoices([]);
                  }}
                  onRemove={(id) =>
                    setContacts((current) =>
                      current.filter((item) => item.id !== id)
                    )
                  }
                />
              </EntityComposer.Main>
              <Show when={error()}>
                <p role="alert" class="px-2 text-sm text-failure">
                  {error()}
                </p>
              </Show>
              <EntityComposer.Footer class="items-center justify-end">
                <Button type="submit" disabled={pending() || !name().trim()}>
                  {pending() ? 'Creating…' : 'Create deal'}
                </Button>
              </EntityComposer.Footer>
            </EntityComposer.Root>
          </form>
        </Panel.Body>
      </Panel>
    </Dialog>
  );
}

function LinkPicker(props: {
  legend: string;
  icon: Component<{ class?: string }>;
  query: string;
  queryLabel: string;
  placeholder: string;
  chosen: Linked[];
  choices: Linked[];
  disabled?: boolean;
  onQuery(value: string): void;
  onAdd(item: Linked): void;
  onRemove(id: string): void;
}) {
  return (
    <fieldset class="flex flex-col gap-2" disabled={props.disabled}>
      <legend class="text-sm font-medium text-ink">{props.legend}</legend>
      <Show when={props.chosen.length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={props.chosen}>
            {(item) => (
              <button
                type="button"
                class={badgeClasses({
                  variant: 'outline',
                  size: 'sm',
                  class: 'max-w-full text-ink',
                })}
                aria-label={`Remove ${item.label}`}
                onClick={() => props.onRemove(item.id)}
              >
                <span class="truncate">{item.label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
      <label class="flex items-center gap-2 rounded-lg border border-edge px-2 py-1">
        <Dynamic
          component={props.icon}
          class="size-3.5 shrink-0 text-ink-muted"
        />
        <input
          aria-label={props.queryLabel}
          placeholder={props.placeholder}
          class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-placeholder"
          value={props.query}
          onInput={(event) => props.onQuery(event.currentTarget.value)}
        />
      </label>
      <ul class="max-h-32 overflow-auto">
        <For each={props.choices}>
          {(item) => (
            <li>
              <button
                type="button"
                class="w-full rounded-md px-2 py-1 text-left text-sm text-ink hover:bg-hover"
                onClick={() => props.onAdd(item)}
              >
                <span class="truncate">{item.label}</span>
              </button>
            </li>
          )}
        </For>
      </ul>
    </fieldset>
  );
}
