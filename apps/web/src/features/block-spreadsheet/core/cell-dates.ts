const DAY_MILLISECONDS = 86_400_000;
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);
/** 1 March 1900: earlier serials count Excel's fictitious 29 February 1900. */
const FIRST_SERIAL = 61;
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];
const NAME = '([a-z]+)\\.?';
const ORDINAL = '(?:st|nd|rd|th)?';
const monthYear = new RegExp(`^${NAME},?[ -](\\d{4})$`);
const monthDayYear = new RegExp(
  `^(?:${NAME},? )?${NAME}[ -](\\d{1,2})${ORDINAL},?[ -](\\d{2}|\\d{4})$`
);
const dayMonthYear = new RegExp(
  `^(?:${NAME},? )?(\\d{1,2})${ORDINAL}([ -])${NAME},?[ -](\\d{2}|\\d{4})$`
);

/** A typed date as an Excel serial, with the Excel format that shows it the
 * way it was typed; without one it shows as Macro's default m/d/yyyy. */
export type TypedDate = { serial: number; numberFormat?: string };

/** The order of day, month and year in the locale's numeric dates. */
function dateOrder(locale: string): 'dmy' | 'mdy' | 'ymd' {
  let parts: string[];
  try {
    parts = new Intl.DateTimeFormat(locale, { timeZone: 'UTC' })
      .formatToParts(0)
      .map((part) => part.type);
  } catch {
    return 'mdy';
  }
  const day = parts.indexOf('day');
  const month = parts.indexOf('month');
  if (parts.indexOf('year') < Math.min(day, month)) return 'ymd';
  return day < month ? 'dmy' : 'mdy';
}

/** A full or abbreviated (three letters or more) English name's index. */
function nameIndex(names: string[], text: string) {
  const index =
    text.length < 3 ? -1 : names.findIndex((name) => name.startsWith(text));
  return index < 0 ? undefined : { index, full: names[index] === text };
}

/** Two-digit years 00–29 are this century and 30–99 the last, as in Excel. */
function fullYear(text: string) {
  const year = Number(text);
  if (text.length === 4) return year;
  return year < 30 ? 2000 + year : 1900 + year;
}

function typedDate(
  year: number,
  month: number,
  day: number,
  numberFormat: string | undefined,
  weekday?: string
): TypedDate | undefined {
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return;
  if (weekday !== undefined) {
    const named = nameIndex(WEEKDAYS, weekday);
    if (named?.index !== date.getUTCDay()) return;
  }
  const serial = (time - SERIAL_EPOCH) / DAY_MILLISECONDS;
  if (serial < FIRST_SERIAL) return;
  return numberFormat === undefined ? { serial } : { serial, numberFormat };
}

/**
 * A date typed into a cell, such as `01/2026`, `Jan 2026`, `Jan 01 2026`,
 * `1 January 2026`, `2026-01-01` or `1/1/26`. All-numeric dates read day and
 * month in the locale's order; names are English. Text that is not a whole
 * date, a day that does not exist, or a weekday that does not match it is
 * undefined, as are dates before March 1900.
 */
export function parseTypedDate(
  input: string,
  locale: string
): TypedDate | undefined {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  let match = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/.exec(text);
  if (match) {
    const [, year, separator, month, day] = match;
    return typedDate(
      Number(year),
      Number(month),
      Number(day),
      `yyyy${separator}mm${separator}dd`
    );
  }
  match = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{2}|\d{4})$/.exec(text);
  if (match) {
    const [, first, separator, second, year] = match;
    const dayFirst = dateOrder(locale) === 'dmy';
    const code = dayFirst
      ? `d${separator}m${separator}yyyy`
      : `m${separator}d${separator}yyyy`;
    return typedDate(
      fullYear(year),
      Number(dayFirst ? second : first),
      Number(dayFirst ? first : second),
      code === 'm/d/yyyy' ? undefined : code
    );
  }
  match = /^(\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match)
    return typedDate(Number(match[2]), Number(match[1]), 1, 'mmm yyyy');
  match = monthYear.exec(text);
  if (match) {
    const month = nameIndex(MONTHS, match[1]);
    return (
      month &&
      typedDate(
        Number(match[2]),
        month.index + 1,
        1,
        `${month.full ? 'mmmm' : 'mmm'} yyyy`
      )
    );
  }
  match = monthDayYear.exec(text);
  if (match) {
    const [, weekday, name, day, year] = match;
    const month = nameIndex(MONTHS, name);
    const weekdayCode = weekday
      ? `${nameIndex(WEEKDAYS, weekday)?.full ? 'dddd' : 'ddd'}, `
      : '';
    return (
      month &&
      typedDate(
        fullYear(year),
        month.index + 1,
        Number(day),
        `${weekdayCode}${month.full ? 'mmmm' : 'mmm'} ${day.length === 2 ? 'dd' : 'd'}, yyyy`,
        weekday
      )
    );
  }
  match = dayMonthYear.exec(text);
  if (match) {
    const [, weekday, day, separator, name, year] = match;
    const month = nameIndex(MONTHS, name);
    const weekdayCode = weekday
      ? `${nameIndex(WEEKDAYS, weekday)?.full ? 'dddd' : 'ddd'}, `
      : '';
    return (
      month &&
      typedDate(
        fullYear(year),
        month.index + 1,
        Number(day),
        `${weekdayCode}${day.length === 2 ? 'dd' : 'd'}${separator}${month.full ? 'mmmm' : 'mmm'}${separator}yyyy`,
        weekday
      )
    );
  }
}

/**
 * A whole-day serial as the numeric date `parseTypedDate` reads back in the
 * same locale, for editing a date cell. Undefined for times of day and
 * serials outside the dates it reads.
 */
export function typedDateText(
  serial: number,
  locale: string
): string | undefined {
  if (!Number.isInteger(serial) || serial < FIRST_SERIAL) return;
  const date = new Date(SERIAL_EPOCH + serial * DAY_MILLISECONDS);
  const year = date.getUTCFullYear();
  if (!(year <= 9999)) return;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  switch (dateOrder(locale)) {
    case 'ymd':
      return `${year}/${month}/${day}`;
    case 'dmy':
      return `${day}/${month}/${year}`;
    case 'mdy':
      return `${month}/${day}/${year}`;
  }
}
