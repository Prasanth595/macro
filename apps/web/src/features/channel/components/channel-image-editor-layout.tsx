import type { JSX } from 'solid-js';

export function ChannelImageEditorLayout(props: {
  sidebar: JSX.Element;
  children: JSX.Element;
  footer: JSX.Element;
}) {
  return (
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-2 items-start gap-8 px-6 max-sm:flex max-sm:flex-col mobile:px-4">
        <div class="min-w-0 max-sm:w-full">{props.children}</div>
        <div class="flex min-w-0 flex-col gap-5 max-sm:w-full">
          {props.sidebar}
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-edge-muted px-6 pt-4 mobile:px-4">
        {props.footer}
      </div>
    </div>
  );
}
