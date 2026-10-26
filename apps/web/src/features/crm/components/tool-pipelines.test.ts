import { describe, expect, it } from 'vitest';
import { entrySummary, formatFieldValue, recordName } from './tool-pipelines';

describe('pipeline tool values', () => {
  it('keeps the denomination with an amount when compact summaries omit its currency column', () => {
    expect(
      entrySummary({
        record: { id: '1' },
        fields: {
          'Contract value': 1234.567,
          Outcome: 'Won',
          Owner: 'me',
          'Revenue currency': 'EUR',
        },
        currencies: { 'Contract value': 'EUR' },
      })
    ).toBe('Contract value: EUR 1,234.567 · Outcome: Won · Owner: me');
    expect(formatFieldValue(100, 'EUR')).toBe('EUR 100');
    expect(formatFieldValue(200, 'USD')).toBe('USD 200');
    expect(formatFieldValue(null, 'EUR')).toBe('empty');
  });
  it('shows people by email and lists joined', () => {
    expect(formatFieldValue('macro|sam@acme.com')).toBe('sam@acme.com');
    expect(formatFieldValue(['macro|a@x.com', 'macro|b@x.com'])).toBe(
      'a@x.com, b@x.com'
    );
    expect(formatFieldValue(null)).toBe('empty');
    expect(formatFieldValue(true)).toBe('true');
  });

  it('does not treat inherited object properties as currency metadata', () => {
    expect(
      entrySummary({
        record: { id: '1' },
        fields: { toString: 25, Revenue: 100 },
        currencies: { Revenue: 'EUR' },
      })
    ).toBe('toString: 25 · Revenue: EUR 100');
  });

  it('names a record by name, then detail, then id', () => {
    expect(recordName({ id: '1', name: 'Acme', detail: 'acme.com' })).toBe(
      'Acme'
    );
    expect(recordName({ id: '1', detail: 'acme.com' })).toBe('acme.com');
    expect(recordName({ id: '1' })).toBe('1');
  });
});
