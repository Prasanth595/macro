import { HeaderViewTabs } from '@components/app/HeaderViewTabs';
import CheckSquareIcon from '@phosphor/check-square.svg';
import EnvelopeIcon from '@phosphor/envelope.svg';
import FilesIcon from '@phosphor/files.svg';
import PhoneIcon from '@phosphor/phone.svg';
import SquaresFourIcon from '@phosphor/squares-four.svg';
import UsersIcon from '@phosphor/users.svg';
import { Tooltip } from '@ui';
import type { Component, JSX } from 'solid-js';
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
  emails: EnvelopeIcon,
  files: FilesIcon,
  tasks: CheckSquareIcon,
  calls: PhoneIcon,
};

/**
 * A CRM record's section tabs for its top bar, like a project's Overview /
 * Tasks tabs. `compact` swaps labels for icons when the bar runs out of room.
 */
export function RecordTabs<S extends CrmRecordSection>(props: {
  sections: readonly S[];
  value: S;
  onChange: (section: S) => void;
  compact?: boolean;
}) {
  const list = () =>
    props.sections.map((section) => {
      const label = CRM_RECORD_SECTION_LABELS[section];
      if (!props.compact) return { value: section, label };
      const Icon = SECTION_ICONS[section];
      return {
        value: section,
        label: (
          <Tooltip label={label}>
            <span class="flex items-center" aria-label={label}>
              <Icon class="size-4" />
              <span class="sr-only">{label}</span>
            </span>
          </Tooltip>
        ),
      };
    });
  return (
    <HeaderViewTabs
      items={list()}
      value={props.value}
      onChange={(value) => props.onChange(value as S)}
      label="Record sections"
    />
  );
}
