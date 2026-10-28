import type { Accessor, Component } from 'solid-js';
import type {
  LinkedRowGroup,
  RowLinkTarget,
  RowReference,
} from '../core/row-links';

export type RowLinksSource = {
  state: Accessor<
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'ready'; groups: LinkedRowGroup[] }
  >;
  refresh(): Promise<void>;
  link(source: RowReference): Promise<void>;
  unlink(rowId: string): Promise<void>;
};

export type LinkedRowsView = Component<{
  target: RowLinkTarget;
  canEdit: boolean;
}>;
