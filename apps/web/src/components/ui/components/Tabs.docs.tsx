import { defineDoc } from '@app/features/ui-gallery/types';
import { createSignal } from 'solid-js';
import { Tabs } from './Tabs';

const options = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: 'Recent' },
  { value: 'threads', label: 'Threads' },
];

function TabsDemo(props: { variant: 'pill' | 'segmented' | 'plain' }) {
  const [value, setValue] = createSignal('all');

  return (
    <div class="w-72">
      <Tabs
        aria-label="Conversation view"
        list={options}
        value={value()}
        onChange={setValue}
        variant={props.variant}
        fullWidth={props.variant === 'segmented'}
      />
    </div>
  );
}

export default defineDoc({
  name: 'Tabs',
  category: 'Navigation',
  description:
    'Single-choice view navigation with a sliding pill, an outlined segmented track, or quiet unframed choices.',
  status: 'stable',
  exports: ['Tabs'],
  import: "import { Tabs } from '@ui';",
  propTypes: ['TabsProps'],
  demos: [
    {
      id: 'pill',
      title: 'Pill',
      description: 'The default borderless track with a sliding selection.',
      render: () => <TabsDemo variant="pill" />,
    },
    {
      id: 'plain',
      title: 'Plain',
      description:
        'Unframed navigation with a quiet 32px selected pill, for information panels.',
      render: () => <TabsDemo variant="plain" />,
    },
    {
      id: 'segmented',
      title: 'Segmented',
      description:
        'A fully rounded 36px outlined track with 1px padding. Equal-width, 32px-tall selected pills use the same fill and border as the standard New button, without an extra shadow.',
      render: () => <TabsDemo variant="segmented" />,
    },
  ],
});
