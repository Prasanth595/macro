import { batch, createSignal, onCleanup } from 'solid-js';
import { v7 as uuidv7 } from 'uuid';
import type { InputCapabilities } from '../context/capabilities';
import {
  applySuggestions,
  emptyDraft,
  type Field,
  fieldsSchema,
  type Intent,
  inferIntent,
  missingFields,
  rankIntents,
  type Scores,
  type Submission,
  type SubmissionResult,
  updateDraftText,
} from '../core/input';
import { localFields, localIntent } from '../core/local-fields';
import { createInferenceQueue } from './inference-queue';

export function createUniversalInput(source: InputCapabilities) {
  const [draft, setDraft] = createSignal(source.readDraft() ?? emptyDraft());
  const [scores, setScores] = createSignal<Scores>([]);
  const [revision, setRevision] = createSignal(0);
  const [classifiedRevision, setClassifiedRevision] = createSignal(-1);
  const [extracted, setExtracted] = createSignal<{
    revision: number;
    intent: Intent;
  }>();
  const [operation, setOperation] = createSignal<
    'submit' | 'save-email-draft'
  >();
  const sending = () => operation() !== undefined;
  const savingEmailDraft = () => operation() === 'save-email-draft';
  const [classificationError, setClassificationError] = createSignal('');
  const [extractionError, setExtractionError] = createSignal('');
  const [submissionError, setSubmissionError] = createSignal('');
  const error = () =>
    submissionError() || extractionError() || classificationError();
  const [result, setResult] = createSignal<SubmissionResult>();
  let decisionRevision = 0;
  let disposed = false;
  let submissionId = draft().submissionId ?? uuidv7();
  const fields = () =>
    fieldsSchema.parse(draft().intent ? draft().fields[draft().intent!] : {});
  const persist = () => source.saveDraft(draft());
  const pending = () => {
    const current = draft();
    if (!current.text.trim() || current.intent === 'search') return false;
    if (!current.locked && classifiedRevision() !== revision()) return true;
    return (
      !!current.intent &&
      current.intent !== 'ai' &&
      (extracted()?.revision !== revision() ||
        extracted()?.intent !== current.intent)
    );
  };
  const usable = (decision: number) =>
    !disposed && decisionRevision === decision && !!draft().text.trim();
  const seed = () => {
    setDraft((current) => {
      const intent =
        current.locked || classifiedRevision() === revision()
          ? current.intent
          : (localIntent(current.text) ?? current.intent);
      if (!intent) return current;
      if (
        extracted()?.revision === revision() &&
        extracted()?.intent === intent
      )
        return current;
      return {
        ...current,
        intent,
        fields: {
          ...current.fields,
          [intent]: applySuggestions(
            current.fields[intent],
            current.edited[intent],
            localFields(current.text, intent)
          ),
        },
      };
    });
  };
  const classificationQueue = createInferenceQueue({
    read: () =>
      !disposed && !sending() && draft().text.trim() && !draft().locked
        ? {
            text: draft().text,
            revision: revision(),
            decision: decisionRevision,
          }
        : undefined,
    key: (input) => String(input.revision),
    async run(input) {
      try {
        const response = await source.classify(input.text, input.revision);
        if (!usable(input.decision) || draft().locked) return;
        if (response.revision !== input.revision)
          throw new Error('Could not detect the input type');
        const previousIntent = draft().intent;
        const intent =
          inferIntent(response.scores) ?? localIntent(draft().text);
        batch(() => {
          setScores(response.scores);
          setDraft((current) => ({ ...current, intent }));
          setClassifiedRevision(input.revision);
          setClassificationError('');
          seed();
        });
        // A newly recognized type extracts the newest text on its own queue.
        extractionQueue.enqueue(intent !== previousIntent);
        persist();
      } catch (failure) {
        if (!usable(input.decision) || revision() !== input.revision) return;
        setDraft((current) => ({
          ...current,
          intent: localIntent(current.text),
        }));
        setClassifiedRevision(input.revision);
        setClassificationError(
          failure instanceof Error
            ? failure.message
            : 'Detection unavailable. Choose a type to continue.'
        );
        persist();
      }
    },
  });
  const extractionQueue = createInferenceQueue({
    read: () => {
      const current = draft();
      if (
        disposed ||
        sending() ||
        !current.text.trim() ||
        !current.intent ||
        current.intent === 'ai' ||
        current.intent === 'search'
      )
        return;
      return {
        text: current.text,
        intent: current.intent,
        revision: revision(),
        decision: decisionRevision,
      };
    },
    key: (input) => `${input.revision}:${input.intent}`,
    async run(input) {
      try {
        const response = await source.extract(
          input.text,
          input.intent,
          input.revision
        );
        if (
          !usable(input.decision) ||
          revision() !== input.revision ||
          draft().intent !== input.intent
        )
          return;
        if (
          response.revision !== input.revision ||
          response.intent !== input.intent
        )
          throw new Error('Could not update the input fields');
        setDraft((current) => ({
          ...current,
          fields: {
            ...current.fields,
            [input.intent]: applySuggestions(
              current.fields[input.intent],
              current.edited[input.intent],
              response.suggestions
            ),
          },
        }));
        setExtractionError('');
        setExtracted({ revision: input.revision, intent: input.intent });
        persist();
      } catch (failure) {
        if (
          !usable(input.decision) ||
          revision() !== input.revision ||
          draft().intent !== input.intent
        )
          return;
        setDraft((current) => updateDraftText(current, current.text));
        seed();
        setExtractionError(
          failure instanceof Error
            ? failure.message
            : 'Could not extract fields. Fill them in to continue.'
        );
        setExtracted({ revision: input.revision, intent: input.intent });
        persist();
      }
    },
  });
  const changed = () => {
    setRevision((value) => value + 1);
    setClassificationError('');
    setExtractionError('');
    setSubmissionError('');
    setResult(undefined);
    if (draft().text.trim()) {
      seed();
      setDraft((current) => ({ ...current, submissionId }));
      if (draft().locked) classificationQueue.clear();
      else classificationQueue.enqueue();
      extractionQueue.enqueue();
    } else {
      classificationQueue.clear();
      extractionQueue.clear();
    }
    persist();
  };
  const setText = (text: string) => {
    if (sending()) return;
    batch(() => {
      if (!text.trim()) {
        decisionRevision++;
        setDraft(emptyDraft());
        setScores([]);
        submissionId = uuidv7();
      } else setDraft((d) => ({ ...d, text }));
      changed();
    });
  };
  const choose = (intent?: Intent) => {
    if (sending()) return;
    batch(() => {
      decisionRevision++;
      setDraft((d) => ({ ...d, intent, locked: !!intent }));
      changed();
    });
  };
  const cycle = (direction = 1) => {
    const candidates = rankIntents(scores());
    if (candidates.length < 2 || sending()) return;
    const index = candidates.findIndex((c) => c.intent === draft().intent);
    const next = (index + direction + candidates.length) % candidates.length;
    choose(candidates[next].intent);
  };
  const edit = (key: Field, value: string) => {
    const intent = draft().intent;
    if (!intent || sending()) return;
    batch(() => {
      decisionRevision++;
      setDraft((d) => ({
        ...d,
        locked: true,
        fields: {
          ...d.fields,
          [intent]: { ...d.fields[intent], [key]: value },
        },
        edited: {
          ...d.edited,
          [intent]: [...new Set([...d.edited[intent], key])],
        },
      }));
      changed();
    });
  };
  const snapshot = (): Submission | undefined => {
    const d = draft();
    return d.intent
      ? { intent: d.intent, text: d.text, fields: fields(), id: submissionId }
      : undefined;
  };
  const validation = () => {
    const input = snapshot();
    return input
      ? (missingFields(input) ?? source.validate(input))
      : 'Choose a type';
  };
  const emailDraftValidation = () => {
    const input = snapshot();
    if (input?.intent !== 'email') return 'Choose Email';
    if (!input.text.trim()) return 'Type something to begin';
    return source.validateEmailDraft(input);
  };
  const complete = async (
    input: Submission,
    operation: 'submit' | 'save-email-draft',
    perform: (input: Submission) => Promise<SubmissionResult>
  ) => {
    setOperation(operation);
    let completed = false;
    decisionRevision++;
    classificationQueue.clear();
    extractionQueue.clear();
    try {
      const saved = await perform(input);
      source.saveDraft(emptyDraft());
      if (disposed) return;
      batch(() => {
        setDraft(emptyDraft());
        setScores([]);
        setSubmissionError('');
        setResult(saved);
      });
      submissionId = uuidv7();
      persist();
      completed = true;
    } catch (failure) {
      if (!disposed)
        setSubmissionError(
          failure instanceof Error
            ? failure.message
            : 'Could not complete the action. Your draft is saved.'
        );
    } finally {
      if (!disposed) {
        setOperation(undefined);
        if (completed) source.onSubmitted?.();
      }
    }
  };
  const submit = async () => {
    const input = snapshot();
    if (!input || sending() || pending() || validation()) return;
    await complete(input, 'submit', source.submit);
  };
  const saveEmailDraft = async () => {
    const input = snapshot();
    if (!input || sending() || pending() || emailDraftValidation()) return;
    await complete(input, 'save-email-draft', source.saveEmailDraft);
  };
  if (draft().text.trim()) {
    seed();
    classificationQueue.enqueue();
    extractionQueue.enqueue();
  }
  onCleanup(() => {
    disposed = true;
    classificationQueue.dispose();
    extractionQueue.dispose();
  });
  return {
    draft,
    fields,
    scores,
    pending,
    sending,
    savingEmailDraft,
    error,
    result,
    setText,
    choose,
    cycle,
    edit,
    submit,
    saveEmailDraft,
    validation,
    emailDraftValidation,
  };
}
export type UniversalInputController = ReturnType<typeof createUniversalInput>;
