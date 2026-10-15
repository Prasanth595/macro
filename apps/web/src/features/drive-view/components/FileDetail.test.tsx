import { ThrownResultError } from '@core/util/result';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@components/app/side-panel', () => ({}));
vi.mock('@core/mobile/native-network-status', () => ({
  nativeNetworkStatus: () => 'online',
}));
vi.mock('@core/component/AccessErrorViews/Unauthorized', () => ({
  default: () => null,
}));
vi.mock('@core/component/AccessErrorViews/NotFound', () => ({
  default: () => null,
}));
vi.mock('@core/component/AccessErrorViews/Gone', () => ({
  default: () => null,
}));
vi.mock('@core/component/LoadingBlock', () => ({ LoadingBlock: () => null }));
vi.mock('@app/features/access-requests/access-requests', () => ({
  DocumentAccessDenied: (props: {
    documentId: string;
    onAccessGranted: () => void;
  }) => (
    <button data-document-id={props.documentId} onClick={props.onAccessGranted}>
      Request access
    </button>
  ),
}));
vi.mock('@ui', () => ({
  Button: (props: { children: JSX.Element; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children}</button>
  ),
}));

import { FileDetailLoadGate } from './FileDetail';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
});

function mount(load: () => Promise<object>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  dispose = render(
    () => (
      <FileDetailLoadGate
        documentId="private-document"
        label="document"
        load={load}
      >
        {() => <div>Document content</div>}
      </FileDetailLoadGate>
    ),
    container
  );
  return container;
}

describe('file access errors', () => {
  it.each(['UNAUTHORIZED', 'FORBIDDEN'])(
    'offers a request for %s and reloads after a grant',
    async (code) => {
      const load = vi
        .fn<() => Promise<object>>()
        .mockRejectedValueOnce(
          new ThrownResultError([{ code, message: 'Unauthorized access' }])
        )
        .mockResolvedValue({});
      const container = mount(load);
      await vi.waitFor(() =>
        expect(container.textContent).toContain('Request access')
      );
      expect(container.textContent).not.toContain('couldn’t be displayed');
      container
        .querySelector<HTMLButtonElement>(
          '[data-document-id="private-document"]'
        )!
        .click();
      await vi.waitFor(() =>
        expect(container.textContent).toContain('Document content')
      );
      expect(load).toHaveBeenCalledTimes(2);
    }
  );

  it.each(['NETWORK_ERROR', 'NOT_FOUND', 'GONE'])(
    'keeps %s separate from denied access',
    async (code) => {
      const container = mount(async () => {
        throw new ThrownResultError([{ code, message: 'Request failed' }]);
      });
      await vi.waitFor(() =>
        expect(container.textContent).toContain('Try again')
      );
      expect(container.textContent).not.toContain('Request access');
    }
  );
});
