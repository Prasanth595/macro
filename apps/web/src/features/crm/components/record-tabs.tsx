import { HeaderIsland } from '@components/app/split-layout/components/HeaderIsland';
import { getIconConfig } from '@core/component/EntityIcon';
import { isTouchDevice } from '@core/mobile/isTouchDevice';
import CaretDownIcon from '@phosphor/caret-down.svg';
import CheckIcon from '@phosphor/check.svg';
import SquaresFourIcon from '@phosphor/squares-four.svg';
import UsersIcon from '@phosphor/users.svg';
import { Dropdown, Tabs } from '@ui';
import { type Component, For, type JSX, Show } from 'solid-js';
import {
  CRM_RECORD_SECTION_LABELS,
  type CrmRecordSection,
} from '../core/record';

const SECTION_ICONS: Record<
  CrmRecordSection,
  Component<JSX.SvgSVGAttributes<SVGSVGElement>>
> = {
  overview: SquaresFourIcon,
  team: UsersIcon,
  emails: getIconConfig('email').icon,
  files: getIconConfig('files').icon,
  tasks: getIconConfig('task').icon,
  calls: getIconConfig('call').icon,
};

/**
 * A CRM record's section tabs for its top bar, like a project's Overview /
 * Tasks tabs. `compact` swaps labels for icons when the bar runs out of room.
 * Touch uses a section menu so every section fits beside the split controls.
 */
export function RecordTabs<S extends CrmRecordSection>(props: {
  sections: readonly S[];
  value: S;
  onChange: (section: S) => void;
  compact?: boolean;
}) {
  return (
    <Show
      when={isTouchDevice()}
      fallback={
        <Tabs
          aria-label="Record sections"
          touch="inset"
          class="shrink-0"
          options={props.sections.map((section) => ({
            value: section,
            label: CRM_RECORD_SECTION_LABELS[section],
            icon: props.compact ? SECTION_ICONS[section] : undefined,
          }))}
          iconOnly={props.compact}
          value={props.value}
          onChange={props.onChange}
        />
      }
    >
      <HeaderIsland class="px-0">
        <Dropdown placement="bottom-start">
          <Dropdown.Trigger
            variant="ghost"
            size="lg"
            aria-label={`Record sections: ${CRM_RECORD_SECTION_LABELS[props.value]}`}
          >
            <span>{CRM_RECORD_SECTION_LABELS[props.value]}</span>
            <CaretDownIcon class="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Content>
            <Dropdown.RadioGroup
              value={props.value}
              onChange={(value) => {
                const section = props.sections.find(
                  (section) => section === value
                );
                if (section) props.onChange(section);
              }}
            >
              <For each={props.sections}>
                {(section) => {
                  const Icon: Component<JSX.SvgSVGAttributes<SVGSVGElement>> =
                    SECTION_ICONS[section];
                  return (
                    <Dropdown.RadioItem value={section} closeOnSelect>
                      <Icon class="size-5" />
                      <span class="flex-1">
                        {CRM_RECORD_SECTION_LABELS[section]}
                      </span>
                      <Dropdown.ItemIndicator>
                        <CheckIcon class="size-4" />
                      </Dropdown.ItemIndicator>
                    </Dropdown.RadioItem>
                  );
                }}
              </For>
            </Dropdown.RadioGroup>
          </Dropdown.Content>
        </Dropdown>
      </HeaderIsland>
    </Show>
  );
}
