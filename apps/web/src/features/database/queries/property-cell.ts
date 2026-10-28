import type { ColumnDetail } from '@service-storage/generated/schemas/columnDetail';
import type { PropertyValue } from '@service-storage/generated/schemas/propertyValue';
import { match } from 'ts-pattern';
import { toCellRange } from '../core/cell-date-range';
import type { DatabaseCellValue } from '../core/database-view';
import { UNAVAILABLE_OPTION } from '../core/grid-cells';

/** Adapt stored properties to the shared editor's values. */
export function databasePropertyCell(
  value: PropertyValue | undefined,
  column: ColumnDetail
): DatabaseCellValue {
  if (!value) return null;
  const listed = (values: string[]) =>
    column.column.config?.kind === 'link' ||
    column.definition.definition.is_multi_select
      ? JSON.stringify(values)
      : (values[0] ?? null);
  return match(value)
    .with({ type: 'Boolean' }, ({ value }) => (value ? 1 : 0))
    .with(
      { type: 'Number' },
      { type: 'String' },
      { type: 'Date' },
      ({ value }) => value
    )
    .with({ type: 'DateRange' }, ({ value }) => toCellRange(value))
    .with({ type: 'Link' }, ({ value }) => listed(value))
    .with({ type: 'EntityReference' }, ({ value }) =>
      listed(value.map((ref) => ref.entity_id))
    )
    .with({ type: 'SelectOption' }, ({ value }) =>
      listed(
        value.map((id) => {
          const option = column.definition.property_options.find(
            (option) => option.id === id
          );
          return option ? String(option.value.value) : UNAVAILABLE_OPTION;
        })
      )
    )
    .exhaustive(() => null);
}
