import { toast } from '@core/component/Toast/Toast';
import CalendarIcon from '@phosphor/calendar-blank.svg';
import CaretLeftIcon from '@phosphor/caret-left.svg';
import CaretRightIcon from '@phosphor/caret-right.svg';
import EnvelopeIcon from '@phosphor/envelope.svg';
import HandshakeIcon from '@phosphor/handshake.svg';
import PhoneIcon from '@phosphor/phone.svg';
import WarningIcon from '@phosphor/warning.svg';
import {
  entityMessagesClient,
  type MessageTimelineEntry,
} from '@service-storage/messages';
import { storageServiceClient } from '@service-storage/client';
import { createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useDatabase } from '../../database/context/database';
import type { DatabaseRow } from '../../database/core/table';
import { toCellDate } from '../../database/core/cell-date';
import { invalidateMessageTimeline } from '@queries/messages/timeline';
import type { DatabaseCellValue } from '../../database/core/database-view';

const NEXT = [
  ['Call', 'Llamada'],
  ['Email', 'Email'],
  ['Meeting', 'Reunión'],
] as const;

const LAST_ACTIONS = [
  'Llamada contestada',
  'Llamada no contestada',
  'Reunión agendada',
  'Reunión realizada',
  'Reunión — no show',
  'WhatsApp',
  'Soporte positivo',
  'Soporte negativo',
  'Entrega',
  'Realizada',
] as const;

const OUTCOMES = [
  ['Won', 'Ganado'],
  ['Lost', 'Perdido'],
  ['Cancelled', 'Cancelado'],
] as const;

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

type Note = { at: string; text: string };

function dayIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function shift(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function cellText(value: DatabaseCellValue | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function formatWhen(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function activityMark(next: string | null, className = 'size-3 shrink-0') {
  if (next === 'Email') return <EnvelopeIcon class={className} />;
  if (next === 'Meeting') return <CalendarIcon class={className} />;
  if (next === 'Call') return <PhoneIcon class={className} />;
  return <WarningIcon class={className} />;
}

function formatStamp(iso: string) {
  const [date, time] = iso.split('T');
  const shown = formatWhen(date);
  return time ? `${shown} ${time.slice(0, 5)}` : shown;
}

function isoOf(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthOf(iso: string | null) {
  const source = iso ?? dayIso(new Date());
  return { year: Number(source.slice(0, 4)), month: Number(source.slice(5, 7)) };
}

function noteFrom(entry: MessageTimelineEntry): Note | null {
  if (entry.type !== 'message') return null;
  const text = entry.message.content.trim();
  return text ? { at: entry.message.created_at, text } : null;
}

async function loadNotes(id: string): Promise<Note[]> {
  try {
    const page = await entityMessagesClient.timeline(
      { type: 'crm_deal', id },
      { limit: 50 }
    );
    return page.entries.flatMap((entry) => {
      const note = noteFrom(entry);
      return note ? [note] : [];
    });
  } catch {
    return [];
  }
}

/** The date pill on a deal card. The date lives on the pipeline row. */
export function DealMention(props: {
  id: string;
  primaryColumnId: string;
  /** The name and companies, without the date line. The table shows that line in its own column. */
  compact?: boolean;
  onOpen(name: string): void;
  onOpenCompany(id: string): void;
}) {
  const database = useDatabase();
  const [deal] = createResource(props.id, async (id) => {
    const loaded = await storageServiceClient.getDeal({ dealId: id });
    if (loaded.isErr())
      return { name: '', companies: [] as { id: string; name: string }[] };
    const companies = await Promise.all(
      loaded.value.companyIds.map(async (companyId) => {
        const company = await storageServiceClient.getCompany({ companyId });
        if (company.isErr()) return null;
        const name = company.value.name || company.value.domains[0]?.domain || '';
        return name ? { id: companyId, name } : null;
      })
    );
    return {
      name: loaded.value.name,
      companies: companies.flatMap((company) => (company ? [company] : [])),
    };
  });
  // Reading the resource while it is loading suspends the whole pipeline page.
  const record = () =>
    deal.state === 'ready' || deal.state === 'refreshing' ? deal.latest : undefined;
  const row = () =>
    database.data.rows
      .snapshot()
      ?.rows.find(
        (entry) =>
          String(entry.cells[props.primaryColumnId] ?? '') === props.id
      );
  const column = (name: string) =>
    database.data.rows.columns().find((entry) => entry.name === name);
  const value = (name: string) => {
    const current = row();
    const field = column(name);
    return current && field ? current.cells[field.id] : null;
  };
  const when = () => cellText(value('When'))?.slice(0, 10) ?? null;
  const next = () => cellText(value('Next activity'));
  const plan = () => cellText(value('Plan')) ?? '';
  const outcome = () => cellText(value('Outcome'));
  async function write(name: string, nextValue: DatabaseCellValue) {
    const current = row();
    const field = column(name);
    if (!current || !field) return;
    const saved = await database.data.rows.write(
      {
        kind: 'cell',
        rowId: current.rowId,
        columnId: field.id,
        value: nextValue,
      },
      database.data.table()?.version,
      false
    );
    if (saved.isErr()) toast.failure('Could not save the deal');
    else if (name === 'Stage' || name === 'When' || name === 'Outcome')
      void invalidateMessageTimeline({ type: 'crm_deal', id: props.id });
  }
  return (
    <span class="flex min-w-0 flex-col">
      <span class="flex min-w-0 items-start gap-2">
        <HandshakeIcon class="mt-0.5 size-4 shrink-0 text-ink-muted" />
        <span class="min-w-0 flex-1">
          <button
            type="button"
            class="block w-full min-w-0 truncate text-left text-sm font-medium leading-5 text-ink hover:underline"
            data-kanban-no-drag
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              props.onOpen(record()?.name ?? '');
            }}
          >
            {record()?.name || '\u00a0'}
          </button>
          <Show when={(record()?.companies.length ?? 0) > 0}>
            <span class="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs font-normal leading-4 text-ink-muted">
              <For each={record()?.companies ?? []}>
                {(company) => (
                  <button
                    type="button"
                    class="max-w-full min-w-0 truncate text-left hover:text-ink hover:underline"
                    data-kanban-no-drag
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      props.onOpenCompany(company.id);
                    }}
                  >
                    {company.name}
                  </button>
                )}
              </For>
            </span>
          </Show>
        </span>
      </span>
      <Show when={!props.compact}>
        <DealPill
          presentation="line"
          when={when()}
          next={next()}
          plan={plan()}
          outcome={outcome()}
          dealId={props.id}
          onWhen={(iso) => void write('When', iso ? toCellDate(new Date(`${iso}T12:00:00`)) : null)}
          onNext={(activity) => void write('Next activity', activity)}
          onPlan={(text) => void write('Plan', text)}
          onOutcome={(closed) => void write('Outcome', closed)}
          onHappened={(text) => postDealNote(props.id, text)}
          onLast={(text) => postDealNote(props.id, text)}
        />
      </Show>
    </span>
  );
}

async function postDealNote(id: string, text: string) {
  try {
    await entityMessagesClient.post({ type: 'crm_deal', id }, { content: text });
  } catch {
    toast.failure('Could not save the note');
  }
}

/** The date line in a table cell. The same editor as the board card. */
export function DealScheduleCell(props: { row: DatabaseRow; primaryColumnId: string }) {
  const database = useDatabase();
  const id = () => {
    const value = props.row.cells[props.primaryColumnId];
    return typeof value === 'string' ? value : '';
  };
  const column = (name: string) =>
    database.data.rows.columns().find((entry) => entry.name === name);
  const value = (name: string) => {
    const field = column(name);
    return field ? props.row.cells[field.id] : null;
  };
  async function write(name: string, nextValue: DatabaseCellValue) {
    const field = column(name);
    const dealId = id();
    if (!field || !dealId) return;
    const saved = await database.data.rows.write(
      {
        kind: 'cell',
        rowId: props.row.rowId,
        columnId: field.id,
        value: nextValue,
      },
      database.data.table()?.version,
      false
    );
    if (saved.isErr()) toast.failure('Could not save the deal');
    else if (name === 'Stage' || name === 'When' || name === 'Outcome')
      void invalidateMessageTimeline({ type: 'crm_deal', id: dealId });
  }
  return (
    <Show when={id()}>
      <span class="flex min-h-9 w-full min-w-0 items-center px-2.5">
        <DealPill
          presentation="cell"
          when={cellText(value('When'))?.slice(0, 10) ?? null}
          next={cellText(value('Next activity'))}
          plan={cellText(value('Plan')) ?? ''}
          outcome={cellText(value('Outcome'))}
          dealId={id()}
          onWhen={(iso) => void write('When', iso ? toCellDate(new Date(`${iso}T12:00:00`)) : null)}
          onNext={(activity) => void write('Next activity', activity)}
          onPlan={(text) => void write('Plan', text)}
          onOutcome={(closed) => void write('Outcome', closed)}
          onHappened={(text) => postDealNote(id(), text)}
          onLast={(text) => postDealNote(id(), text)}
        />
      </span>
    </Show>
  );
}

/** The date or outcome label, with no editor. */
export function DealDateBadge(props: { when: string | null; outcome: string | null }) {
  return <PillFace when={props.when} outcome={props.outcome} />;
}

function latestLastAction(notes: Note[]) {
  let best: Note | undefined;
  for (const note of notes) {
    if (!LAST_ACTIONS.some((action) => action === note.text)) continue;
    if (!best || note.at > best.at) best = note;
  }
  return best?.text ?? '';
}

function pillLabel(when: string | null, outcome: string | null) {
  const closed = OUTCOMES.find(([id]) => id === outcome);
  if (closed)
    return {
      text: closed[1],
      tone: closed[0] === 'Won' ? ('won' as const) : ('closed' as const),
      icon: false,
    };
  if (!when) return null;
  const today = dayIso(new Date());
  if (when > today) {
    const days = Math.round(
      (new Date(`${when}T12:00:00`).getTime() -
        new Date(`${today}T12:00:00`).getTime()) /
        86_400_000
    );
    return { text: `en ${days}d`, tone: 'later' as const, icon: true };
  }
  if (when === today) return { text: 'Hoy', tone: 'today' as const, icon: true };
  const days = Math.round(
    (new Date(`${today}T12:00:00`).getTime() -
      new Date(`${when}T12:00:00`).getTime()) /
      86_400_000
  );
  return { text: `${days}d retraso`, tone: 'late' as const, icon: true };
}

function PillFace(props: {
  when: string | null;
  next?: string | null;
  outcome: string | null;
  push?: boolean;
}) {
  const shown = () => pillLabel(props.when, props.outcome);
  return (
    <Show when={shown()}>
      {(mark) => (
        <span
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
          classList={{
            'ml-auto': !!props.push,
            'bg-[#6d4aff] text-white': mark().tone === 'later',
            'bg-failure/15 text-failure': mark().tone === 'today',
            'bg-[#e11d48] text-white': mark().tone === 'late',
            'bg-[#dcfce7] text-[#166534]': mark().tone === 'won',
            'bg-[#f3f4f6] text-[#6b7280]': mark().tone === 'closed',
          }}
        >
          <Show when={mark().icon && props.next !== undefined}>
            {activityMark(props.next ?? null)}
          </Show>
          {mark().text}
        </span>
      )}
    </Show>
  );
}

/** Date, next activity and outcome, opened where the pill was clicked. */
export function DealPill(props: {
  presentation?: 'line' | 'cell' | 'pill';
  when: string | null;
  next: string | null;
  plan: string;
  outcome: string | null;
  /** Loads the history when the date line opens, without holding the board. */
  dealId?: string;
  notes?: Note[];
  onWhen(iso: string | null): void;
  onNext(activity: string): void;
  onPlan(text: string): void;
  onOutcome(outcome: string | null): void;
  onHappened(text: string): Promise<void>;
  onLast(action: string): Promise<void>;
}) {
  const [open, setOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal({ left: 0, top: 0, bottom: 0 });
  const [placed, setPlaced] = createSignal({ left: 8, top: 8 });
  const [view, setView] = createSignal(monthOf(props.when));
  const [happened, setHappened] = createSignal('');
  const [plan, setPlan] = createSignal(props.plan);
  const [notes, setNotes] = createSignal<Note[]>(props.notes ?? []);
  const [picked, setPicked] = createSignal<string | null>(null);
  const [panel, setPanel] = createSignal<HTMLDivElement>();
  function refreshNotes() {
    const id = props.dealId;
    if (!id) return;
    void loadNotes(id).then((loaded) => {
      if (props.dealId === id) setNotes(loaded);
    });
  }
  createEffect(() => {
    const bounds = anchor();
    const shown = open();
    const element = panel();
    view();
    happened();
    plan();
    notes();
    if (!shown || !element) return;
    const width = element.offsetWidth || 328;
    const height = element.offsetHeight;
    let left = Math.min(bounds.left, window.innerWidth - width - 12);
    left = Math.max(8, left);
    let top = bounds.bottom + 8;
    if (top + height > window.innerHeight - 8)
      top = Math.max(8, bounds.top - height - 8);
    setPlaced((current) =>
      current.left === left && current.top === top ? current : { left, top }
    );
  });
  function keepNote() {
    const note = happened().trim();
    if (!note) return;
    setHappened('');
    void props.onHappened(note).then(() => refreshNotes());
  }
  function close() {
    keepNote();
    if (plan() !== props.plan) props.onPlan(plan());
    setOpen(false);
  }
  const label = () => pillLabel(props.when, props.outcome);
  const last = () => picked() ?? latestLastAction(notes());
  const due = () => {
    const when = props.when;
    return !!when && when <= dayIso(new Date()) && !props.outcome;
  };
  function openAt(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (open()) {
      close();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom });
    setPlaced({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 340)),
      top: rect.bottom + 8,
    });
    setView(monthOf(props.when));
    setPlan(props.plan);
    setHappened('');
    setPicked(null);
    refreshNotes();
    setOpen(true);
  }
  function chooseDay(iso: string) {
    keepNote();
    props.onWhen(iso);
  }
  return (
    <span
      class="relative block min-w-0"
      classList={{ 'w-full': props.presentation === 'line' }}
      data-kanban-no-drag
    >
      <Show
        when={props.presentation === 'line' || props.presentation === 'cell'}
        fallback={
          <Show when={label()}>
            <button type="button" class="border-0 bg-transparent p-0" onClick={openAt}>
              <PillFace when={props.when} next={props.next} outcome={props.outcome} />
            </button>
          </Show>
        }
      >
        <button
          type="button"
          class="flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-xs font-normal text-ink-muted hover:text-ink"
          classList={{
            'mt-2 w-full': props.presentation === 'line',
          }}
          onClick={openAt}
        >
          <Show when={!props.outcome}>
            <span
              classList={{
                'tabular-nums': !!props.when,
                'text-ink-extra-muted': !props.when,
              }}
            >
              {props.when ? formatWhen(props.when) : 'Sin fecha'}
            </span>
          </Show>
          <Show when={props.presentation === 'line' && notes().length > 0}>
            <span class="ml-auto tabular-nums text-ink-extra-muted">
              {notes().length}
            </span>
          </Show>
          <PillFace
            push={props.presentation === 'line' && notes().length === 0}
            when={props.when}
            next={props.next}
            outcome={props.outcome}
          />
        </button>
      </Show>
      <Show when={open()}>
        <Portal>
        <button
          type="button"
          class="fixed inset-0 z-[1100] cursor-default"
          aria-label="Close"
          onClick={(event) => {
            event.stopPropagation();
            close();
          }}
        />
        <div
          ref={setPanel}
          class="fixed z-[1101] max-h-[calc(100vh-16px)] w-[328px] overflow-auto rounded-xl border border-edge bg-surface p-3 shadow-[0_12px_40px_oklch(0.15_0_0/0.16)]"
          style={{ left: `${placed().left}px`, top: `${placed().top}px` }}
          data-kanban-no-drag
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <label class="mb-2.5 flex flex-col gap-1.5 text-xs text-ink-muted">
            Última acción
            <select
              class="h-8 rounded-lg border border-edge bg-surface px-2 text-xs text-ink"
              value={last()}
              onChange={(event) => {
                const action = event.currentTarget.value;
                if (!action) return;
                setPicked(action);
                void props.onLast(action).then(() => refreshNotes());
              }}
            >
              <option value="">Sin anotar</option>
              <For each={LAST_ACTIONS}>
                {(action) => <option value={action}>{action}</option>}
              </For>
            </select>
          </label>
          <Show when={due()}>
            <label class="flex flex-col gap-1.5 text-xs text-ink-muted">
              Qué ha pasado
              <textarea
                class="w-full resize-y rounded-lg border border-edge bg-transparent p-2 text-[13px] text-ink"
                rows={2}
                placeholder="Por ejemplo, llamé y no lo cogió"
                value={happened()}
                onInput={(event) => setHappened(event.currentTarget.value)}
              />
            </label>
          </Show>
          <div class="my-3 h-px bg-edge-muted" />
          <div class="mb-1.5 text-xs text-ink-muted">Siguiente acción</div>
          <div class="flex flex-wrap gap-1.5">
            <ForDay label="Hoy" days={0} when={props.when} onWhen={chooseDay} />
            <ForDay label="Mañana" days={1} when={props.when} onWhen={chooseDay} />
            <ForDay label="La semana que viene" days={7} when={props.when} onWhen={chooseDay} />
            <ForDay label="En 2 semanas" days={14} when={props.when} onWhen={chooseDay} />
          </div>
          <MonthGrid
            year={view().year}
            month={view().month}
            when={props.when}
            onWhen={chooseDay}
            onMonth={(step) =>
              setView((current) => {
                let month = current.month + step;
                let year = current.year;
                if (month < 1) {
                  month = 12;
                  year -= 1;
                }
                if (month > 12) {
                  month = 1;
                  year += 1;
                }
                return { year, month };
              })
            }
          />
          <div class="mt-3 flex gap-1.5">
            {NEXT.map(([id, text]) => (
              <button
                type="button"
                class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-edge bg-surface text-xs text-ink"
                classList={{
                  'border-[#c4b5fd] bg-[#6d4aff]/10 font-semibold': props.next === id,
                }}
                onClick={() => props.onNext(id)}
              >
                {activityMark(id, 'size-3.5 shrink-0')}
                {text}
              </button>
            ))}
          </div>
          <label class="mt-2.5 flex flex-col gap-1.5 text-xs text-ink-muted">
            Lo que tienes planeado hacer
            <textarea
              class="w-full resize-y rounded-lg border border-edge bg-transparent p-2 text-[13px] text-ink"
              rows={2}
              value={plan()}
              onInput={(event) => setPlan(event.currentTarget.value)}
              onChange={(event) => props.onPlan(event.currentTarget.value)}
            />
          </label>
          <div class="my-3 h-px bg-edge-muted" />
          <div class="flex gap-1.5">
            {OUTCOMES.map(([id, text]) => (
              <button
                type="button"
                class="h-8 flex-1 rounded-lg border border-edge bg-surface text-xs text-ink"
                classList={{
                  'border-[#86efac] bg-[#dcfce7] text-[#166534]':
                    props.outcome === id && id === 'Won',
                  'border-[#d1d5db] bg-[#f3f4f6] text-[#4b5563]':
                    props.outcome === id && id !== 'Won',
                }}
                onClick={() => {
                  keepNote();
                  props.onOutcome(id);
                }}
              >
                {text}
              </button>
            ))}
          </div>
          <Show when={notes().length > 0}>
            <div class="my-3 h-px bg-edge-muted" />
            <div class="flex flex-col gap-1.5 text-xs text-ink-muted">
              Historial
              <div>
                <For each={notes()}>
                  {(note) => (
                    <p class="mb-2 text-[13px] leading-snug text-ink">
                      <time class="block text-[11px] text-ink-extra-muted">
                        {formatStamp(note.at)}
                      </time>
                      {note.text}
                    </p>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
        </Portal>
      </Show>
    </span>
  );
}

function MonthGrid(props: {
  year: number;
  month: number;
  when: string | null;
  onWhen(iso: string): void;
  onMonth(step: number): void;
}) {
  const today = dayIso(new Date());
  const cells = () => {
    const first =
      (new Date(Date.UTC(props.year, props.month - 1, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(props.year, props.month, 0)).getUTCDate();
    const prevCount = new Date(Date.UTC(props.year, props.month - 1, 0)).getUTCDate();
    const days: { iso: string; day: number; out: boolean }[] = [];
    for (let index = 0; index < first; index += 1) {
      const day = prevCount - first + 1 + index;
      const month = props.month === 1 ? 12 : props.month - 1;
      const year = props.month === 1 ? props.year - 1 : props.year;
      days.push({ iso: isoOf(year, month, day), day, out: true });
    }
    for (let day = 1; day <= count; day += 1)
      days.push({ iso: isoOf(props.year, props.month, day), day, out: false });
    let next = 1;
    while (days.length % 7) {
      const month = props.month === 12 ? 1 : props.month + 1;
      const year = props.month === 12 ? props.year + 1 : props.year;
      days.push({ iso: isoOf(year, month, next), day: next, out: true });
      next += 1;
    }
    return days;
  };
  const title = () => {
    const name = MONTHS[props.month - 1] ?? '';
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${props.year}`;
  };
  return (
    <>
      <div class="mt-3 mb-1.5 flex items-center text-sm font-semibold text-ink">
        <span>{title()}</span>
        <div class="ml-auto flex">
          <button
            type="button"
            class="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
            aria-label="Mes anterior"
            onClick={() => props.onMonth(-1)}
          >
            <CaretLeftIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
            aria-label="Mes siguiente"
            onClick={() => props.onMonth(1)}
          >
            <CaretRightIcon class="size-3.5" />
          </button>
        </div>
      </div>
      <div class="mb-0.5 grid grid-cols-7">
        <For each={WEEKDAYS}>
          {(day) => (
            <span class="py-0.5 text-center text-[11px] text-ink-extra-muted">{day}</span>
          )}
        </For>
      </div>
      <div class="grid grid-cols-7">
        <For each={cells()}>
          {(cell) => (
            <button
              type="button"
              class="h-8 rounded-lg text-[13px] hover:bg-hover"
              classList={{
                'text-[#c5c5c5]': cell.out && cell.iso !== props.when,
                'ring-1 ring-inset ring-ink':
                  cell.iso === today && cell.iso !== props.when,
                'bg-[oklch(62.3%_0.214_259.815)] text-white': cell.iso === props.when,
              }}
              onClick={() => props.onWhen(cell.iso)}
            >
              {cell.day}
            </button>
          )}
        </For>
      </div>
    </>
  );
}

function ForDay(props: {
  label: string;
  days: number;
  when: string | null;
  onWhen(iso: string | null): void;
}) {
  const iso = () => dayIso(shift(props.days));
  return (
    <button
      type="button"
      class="rounded-lg border border-edge bg-surface px-2 py-1 text-xs font-medium"
      classList={{
        'border-ink/20 bg-active': props.when === iso(),
      }}
      onClick={() => {
        props.onWhen(iso());
      }}
    >
      {props.label}
    </button>
  );
}
