import { Select } from '@ui';
import { createMemo } from 'solid-js';
import type { FileTypeOption } from '../core/file-types';

const UNCLASSIFIED = 'unclassified';

export function FileTypeSelect(props: {
  options: FileTypeOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  emptyLabel?: string;
  label?: string;
}) {
  const options = createMemo(() => [
    { id: UNCLASSIFIED, name: props.emptyLabel ?? 'Unclassified' },
    ...props.options,
  ]);
  return (
    <Select<FileTypeOption>
      options={options()}
      optionValue="id"
      optionTextValue="name"
      value={options().find(
        (option) => option.id === (props.value ?? UNCLASSIFIED)
      )}
      onChange={(value) => {
        if (value && value.id !== (props.value ?? UNCLASSIFIED))
          props.onChange(value.id === UNCLASSIFIED ? null : value.id);
      }}
      disabled={props.disabled}
      itemComponent={(item) => (
        <Select.Item item={item.item}>
          <Select.ItemLabel>{item.item.rawValue.name}</Select.ItemLabel>
          <Select.ItemIndicator />
        </Select.Item>
      )}
    >
      <Select.Trigger aria-label={props.label ?? 'File type'}>
        <Select.Value<FileTypeOption>>
          {(state) => state.selectedOption().name}
        </Select.Value>
        <Select.Icon />
      </Select.Trigger>
      <Select.Content portalScope="local">
        <Select.Listbox />
      </Select.Content>
    </Select>
  );
}
