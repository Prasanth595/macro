import { SERVER_HOSTS } from '@core/constant/servers';
import { fetchWithToken } from '@core/util/fetchWithToken';
import { z } from 'zod';
import type { ClassifyInputRequest } from './generated/schemas/classifyInputRequest';
import type { ExtractInputRequest } from './generated/schemas/extractInputRequest';
import { InputIntent } from './generated/schemas/inputIntent';

// Wire decoding stays here; the feature adapter maps it into its own vocabulary.
const intent = z.enum(InputIntent);
const text = z.string().nullish();
const classification = z.object({
  revision: z.number(),
  scores: z
    .array(z.object({ intent, score: z.number().min(0).max(1) }))
    .length(7),
});
const weekday = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
const recurrence = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().positive(),
  by_day: z.array(weekday),
  monthly_by_day: z.object({ ordinal: z.number().int(), weekday }).nullish(),
  ends: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('never') }),
    z.object({ kind: z.literal('after'), count: z.number().int().positive() }),
    z.object({ kind: z.literal('on'), date: z.iso.date() }),
  ]),
});
const extraction = z.discriminatedUnion('intent', [
  z.object({
    revision: z.number(),
    intent: z.literal('ai'),
    suggestions: z.object({}),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('search'),
    suggestions: z.object({
      query: text,
      search_scope: text,
      search_from: z.array(z.string()).default([]),
      search_in: z.array(z.string()).default([]),
    }),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('email'),
    suggestions: z.object({
      subject: text,
      body: text,
      recipients: z.array(z.string()).default([]),
      cc: z.array(z.string()).default([]),
      bcc: z.array(z.string()).default([]),
    }),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('note'),
    suggestions: z.object({ title: text, body: text }),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('task'),
    suggestions: z.object({
      title: text,
      body: text,
      due_date: text,
      properties: z
        .array(z.object({ name: z.string(), values: z.array(z.string()) }))
        .default([]),
    }),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('calendar'),
    suggestions: z.object({
      title: text,
      body: text,
      start: text,
      start_assumption: text,
      end: text,
      location: text,
      guests: z.array(z.string()).default([]),
      recurrence: recurrence.nullish(),
    }),
  }),
  z.object({
    revision: z.number(),
    intent: z.literal('message'),
    suggestions: z.object({
      body: text,
      recipients: z.array(z.string()).default([]),
    }),
  }),
]);

async function request<T>(
  path: string,
  body: object,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await fetchWithToken<Record<string, unknown>>(
    `${SERVER_HOSTS['agent-harness']}/universal_input/${path}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (response.isErr())
    throw new Error(
      'Automatic suggestions are unavailable. Choose a type and fill in the fields.'
    );
  return schema.parse(response.value);
}

export const universalInputClient = {
  classify: (text: string, revision: number) =>
    request(
      'classify',
      { text, revision } satisfies ClassifyInputRequest,
      classification
    ),
  extract: (
    text: string,
    selected: z.infer<typeof intent>,
    revision: number,
    properties: { name: string; options: string[] }[] = []
  ) =>
    request(
      'extract',
      {
        text,
        intent: selected,
        revision,
        reference_time: new Date().toISOString(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        property_definitions: selected === 'task' ? properties : [],
      } satisfies ExtractInputRequest,
      extraction
    ),
};
