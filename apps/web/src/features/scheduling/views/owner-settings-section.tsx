import ArrowSquareOut from '@phosphor/arrow-square-out.svg';
import Copy from '@phosphor/copy.svg';
import { ButtonGroup, CopyButton, Tooltip } from '@ui';
import { Match, Show, Switch } from 'solid-js';
import { AvailabilityPanel } from '../components/availability-panel';
import { BookingPageEditor } from '../components/booking-page-editor';
import { BookingsPanel } from '../components/bookings-panel';
import { EventTypesPanel } from '../components/event-types-panel';
import { useScheduling } from '../context/scheduling-context';
import type { SchedulingOwner } from '../primitives/create-scheduling-owner';
import { EventEditor } from './event-editor-view';
import { InsightsView } from './insights-view';
import { ScheduleEditor } from './schedule-editor-view';
import { SinglePageEventEditorView } from './single-page-event-editor-view';

export function OwnerSettingsSection(props: {
  kind: 'links' | 'availability' | 'page' | 'bookings' | 'insights';
  owner: SchedulingOwner;
  search?: string;
  scheduleTopBarOwned?: boolean;
}) {
  const capabilities = useScheduling();
  const owner = props.owner;
  const {
    scope,
    source,
    event,
    eventEditorVariant,
    schedule,
    profileDraft,
    setProfileDraft,
    save,
    action,
    busyBooking,
    bookingAction,
    closeEventEditor,
    closeScheduleEditor,
    createEventSinglePage,
    editEventSinglePage,
    duplicate,
  } = owner;
  async function copyPageLink() {
    const profile = source.profile();
    if (!profile?.revision) return false;
    let copied = false;
    await action(async () => {
      await capabilities.copyLink(profile);
      copied = true;
    });
    return copied;
  }
  return (
    <Show when={source.profile()}>
      {(p) => (
        <Switch>
          <Match when={props.kind === 'links'}>
            <div
              class="min-w-0"
              role="group"
              aria-label={`${scope().name} ${props.kind === 'page' ? 'booking page' : props.kind}`}
            >
              <Show when={event()} keyed>
                {(value) => (
                  <Show
                    when={eventEditorVariant() === 'single'}
                    fallback={
                      <EventEditor
                        event={value}
                        events={p().eventTypes}
                        schedules={owner.eventSchedules()}
                        members={capabilities.members()}
                        team={!!scope().teamId}
                        defaultHosts={[capabilities.userId()]}
                        saving={source.saving()}
                        createActive={owner.createActive()}
                        dialogTitle={
                          p().eventTypes.some((item) => item.id === value.id)
                            ? 'Edit booking link'
                            : `New ${scope().teamId ? 'team' : 'personal'} booking link`
                        }
                        link={(slug) => capabilities.link(p(), slug)}
                        onCopyLink={(slug) => capabilities.copyLink(p(), slug)}
                        onCancel={closeEventEditor}
                        onSave={owner.saveEvent}
                      />
                    }
                  >
                    <SinglePageEventEditorView
                      event={value}
                      events={p().eventTypes}
                      schedules={owner.eventSchedules()}
                      members={capabilities.members()}
                      team={!!scope().teamId}
                      defaultHosts={[capabilities.userId()]}
                      saving={source.saving()}
                      createActive={owner.createActive()}
                      dialogTitle={
                        p().eventTypes.some((item) => item.id === value.id)
                          ? 'Edit booking link'
                          : `New ${scope().teamId ? 'team' : 'personal'} booking link`
                      }
                      link={(slug) => capabilities.link(p(), slug)}
                      onCopyLink={(slug) => capabilities.copyLink(p(), slug)}
                      onCancel={closeEventEditor}
                      onSave={owner.saveEvent}
                    />
                  </Show>
                )}
              </Show>
              <EventTypesPanel
                owner={scope()}
                search={props.search ?? ''}
                events={p().eventTypes}
                canEdit={scope().canEdit}
                saving={source.saving()}
                onEdit={owner.editEvent}
                onEditSinglePage={editEventSinglePage}
                onCreateSinglePage={() => void createEventSinglePage()}
                onDuplicate={duplicate}
                link={(item) => capabilities.link(p(), item.slug)}
                onCopy={(item) =>
                  void action(() => capabilities.copyLink(p(), item.slug))
                }
                onToggle={(item, enabled) =>
                  void action(() =>
                    save({
                      ...p(),
                      eventTypes: p().eventTypes.map((e) =>
                        e.id === item.id ? { ...e, enabled } : e
                      ),
                    })
                  )
                }
                onDelete={(item) =>
                  void action(() =>
                    save({
                      ...p(),
                      eventTypes: p().eventTypes.filter(
                        (e) => e.id !== item.id
                      ),
                    })
                  )
                }
              />
            </div>
          </Match>
          <Match when={props.kind === 'availability'}>
            <div
              class="flex min-h-0 min-w-0 flex-1 flex-col"
              role="group"
              aria-label={`${scope().name} ${props.kind === 'page' ? 'booking page' : props.kind}`}
            >
              <Show
                when={!schedule()}
                fallback={
                  <Show when={schedule()} keyed>
                    {(value) => (
                      <ScheduleEditor
                        schedule={value}
                        topBarOwned={props.scheduleTopBarOwned}
                        creating={
                          !p().schedules.some(
                            (schedule) => schedule.id === value.id
                          )
                        }
                        saving={source.saving()}
                        onCancel={closeScheduleEditor}
                        onSave={async (next) => {
                          const exists = p().schedules.some(
                            (s) => s.id === next.id
                          );
                          await save({
                            ...p(),
                            defaultScheduleId:
                              p().defaultScheduleId ??
                              p().schedules[0]?.id ??
                              next.id,
                            schedules: exists
                              ? p().schedules.map((s) =>
                                  s.id === next.id ? next : s
                                )
                              : [...p().schedules, next],
                          });
                          if (schedule()?.id === next.id) closeScheduleEditor();
                        }}
                      />
                    )}
                  </Show>
                }
              >
                <AvailabilityPanel
                  profile={p()}
                  canEdit={scope().canEdit}
                  saving={source.saving()}
                  onEdit={owner.editSchedule}
                  onDefault={(s) =>
                    void action(() => save({ ...p(), defaultScheduleId: s.id }))
                  }
                  onDelete={(s) =>
                    void action(async () => {
                      if (p().eventTypes.some((e) => e.scheduleId === s.id))
                        throw new Error(
                          'Move event types to another schedule first.'
                        );
                      const schedules = p().schedules.filter(
                        (x) => x.id !== s.id
                      );
                      await save({
                        ...p(),
                        schedules,
                        defaultScheduleId:
                          p().defaultScheduleId === s.id
                            ? (schedules[0]?.id ?? null)
                            : p().defaultScheduleId,
                      });
                    })
                  }
                />
              </Show>
            </div>
          </Match>
          <Match when={props.kind === 'page'}>
            <div
              class="flex min-h-0 min-w-0 flex-1 flex-col"
              role="group"
              aria-label={`${scope().name} ${props.kind === 'page' ? 'booking page' : props.kind}`}
            >
              <div class="mb-4 flex shrink-0 flex-wrap items-center justify-end gap-3">
                <ButtonGroup class="min-w-0 max-w-full">
                  <Tooltip
                    label={
                      p().revision
                        ? capabilities.link(p())
                        : 'Save your booking page before sharing'
                    }
                    class="min-w-0 flex-1 self-stretch"
                  >
                    <a
                      aria-label="Preview page"
                      aria-disabled={!p().revision}
                      tabindex={p().revision ? undefined : -1}
                      class="flex min-w-0 flex-1 items-center gap-2 self-stretch px-3 text-sm text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent aria-disabled:opacity-50"
                      href={p().revision ? capabilities.link(p()) : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span class="truncate">{capabilities.link(p())}</span>
                      <ArrowSquareOut
                        aria-hidden="true"
                        class="size-3.5 shrink-0"
                      />
                    </a>
                  </Tooltip>
                  <ButtonGroup.Divider />
                  <CopyButton
                    variant="ghost"
                    size="icon-md"
                    label="Copy page link"
                    disabled={!p().revision}
                    onClick={copyPageLink}
                  >
                    <Copy aria-hidden="true" class="size-4" />
                  </CopyButton>
                </ButtonGroup>
              </div>
              <BookingPageEditor
                profile={{
                  id: p().id,
                  name: profileDraft()?.name ?? p().name,
                  description: profileDraft()?.description ?? p().description,
                  eventTypes: p().eventTypes.filter((event) => event.enabled),
                }}
                canEdit={scope().canEdit}
                saving={source.saving()}
                hasChanges={!!profileDraft()}
                onName={(name) =>
                  setProfileDraft({
                    name,
                    description: profileDraft()?.description ?? p().description,
                  })
                }
                onDescription={(description) =>
                  setProfileDraft({
                    name: profileDraft()?.name ?? p().name,
                    description,
                  })
                }
                onSave={() =>
                  void action(async () => {
                    await save({ ...p(), ...profileDraft() });
                    setProfileDraft(undefined);
                  })
                }
              />
            </div>
          </Match>
          <Match when={props.kind === 'bookings'}>
            <div
              class="min-w-0"
              role="group"
              aria-label={`${scope().name} ${props.kind === 'page' ? 'booking page' : props.kind}`}
            >
              <BookingsPanel
                bookings={source.bookings()}
                events={p().eventTypes}
                members={capabilities.members()}
                currentUserId={capabilities.userId()}
                canEdit={scope().canEdit}
                busyId={busyBooking()}
                onApprove={(id) =>
                  void bookingAction(id, () => source.approve(id))
                }
                onCancel={(id) =>
                  void bookingAction(id, () => source.cancel(id))
                }
                onManage={(id) =>
                  void bookingAction(id, () => capabilities.manageBooking(id))
                }
                onAttendance={(id, attendance) =>
                  void bookingAction(id, () =>
                    source.setAttendance(id, attendance)
                  )
                }
              />
            </div>
          </Match>
          <Match when={props.kind === 'insights'}>
            <div
              class="min-w-0"
              role="group"
              aria-label={`${scope().name} ${props.kind === 'page' ? 'booking page' : props.kind}`}
            >
              <Show when={scope().id} keyed>
                {(_scopeId) => (
                  <InsightsView
                    source={source}
                    events={p().eventTypes}
                    members={capabilities.members()}
                    timeZone={
                      p().schedules.find((s) => s.id === p().defaultScheduleId)
                        ?.timeZone ??
                      p().schedules[0]?.timeZone ??
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                  />
                )}
              </Show>
            </div>
          </Match>
        </Switch>
      )}
    </Show>
  );
}
