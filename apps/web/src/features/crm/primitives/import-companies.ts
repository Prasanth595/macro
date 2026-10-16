import { parseCsv } from '@core/util/csv';
import { createSignal } from 'solid-js';
import type { CompanyImporter } from '../context/crm-sources';
import {
  type CompanyImportRow,
  companyImportMessage,
  normalizeCompanyImport,
} from '../core/import-companies';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** Concurrent creates: fast enough for thousands of rows, gentle on the service. */
const IMPORT_CONCURRENCY = 4;

export function createCompanyImport(importer: CompanyImporter) {
  const [rows, setRows] = createSignal<CompanyImportRow[]>([]);
  const [skipped, setSkipped] = createSignal(0);
  const [error, setError] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [completed, setCompleted] = createSignal(0);
  const [existing, setExisting] = createSignal(0);
  async function read(file?: Pick<File, 'size' | 'text'>) {
    setError('');
    setRows([]);
    setSkipped(0);
    setCompleted(0);
    setExisting(0);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError('Choose a CSV smaller than 5 MB.');
      return;
    }
    try {
      const parsed = parseCsv((await file.text()).replace(/^﻿/, ''));
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      normalizeCompanyImport(parsed.records).match(
        (normalized) => {
          setRows(normalized.rows);
          setSkipped(normalized.skipped);
        },
        (failure) => setError(companyImportMessage(failure))
      );
    } catch {
      setError('Could not read that file. Please try again.');
    }
  }
  async function importRow(row: CompanyImportRow) {
    try {
      const outcome = await importer.create(row);
      if (outcome === 'exists') setExisting((n) => n + 1);
      else setCompleted((n) => n + 1);
      return true;
    } catch {
      return false;
    }
  }
  async function run() {
    if (pending() || !rows().length) return;
    setPending(true);
    setError('');
    const queue = [...rows()];
    const failed = new Set<CompanyImportRow>();
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift())
        if (!(await importRow(row))) failed.add(row);
    };
    await Promise.all(Array.from({ length: IMPORT_CONCURRENCY }, worker));
    try {
      await importer.refresh();
    } catch {
      // The companies exist; listings catch up on their next read.
    }
    setRows((all) => all.filter((row) => failed.has(row)));
    setPending(false);
    if (failed.size)
      setError(
        `${failed.size} could not be imported. They may use an unsupported domain, such as gmail.com. Successful rows will not be retried.`
      );
  }
  return {
    rows,
    skipped,
    error,
    pending,
    completed,
    existing,
    read,
    run,
  };
}
