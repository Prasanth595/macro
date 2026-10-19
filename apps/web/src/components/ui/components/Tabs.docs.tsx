import { defineDoc } from '@app/features/ui-gallery/types';
import { createSignal } from 'solid-js';
import { Tabs } from './Tabs';

const options = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: 'Recent' },
  { value: 'threads', label: 'Threads' },
];

function TabsDemo(props: { variant: 'pill' | 'segmented' }) {
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
    'Single-choice view navigation with either a sliding pill or a flat segmented track.',
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
      id: 'segmented',
      title: 'Segmented',
      description:
        'A 32px track with 3px padding and equal-width, rounded rectangular choices.',
      render: () => <TabsDemo variant="segmented" />,
    },
  ],
});
