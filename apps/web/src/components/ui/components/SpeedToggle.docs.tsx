import { EffortSelector } from '@app/features/block-agent/component/EffortSelector';
import { defineDoc } from '@app/features/ui-gallery/types';
import { SpeedToggle } from '@core/component/AI/component/input/SpeedToggle';
import { Model } from '@core/component/AI/constant/model';
import { createSignal } from 'solid-js';

// #region demo:effort-and-speed
function EffortAndSpeedDemo() {
  const [effort, setEffort] = createSignal('medium');
  const [fast, setFast] = createSignal(false);
  return (
    <div class="flex items-center gap-3">
      <span>Example model</span>
      <EffortSelector
        config={{
          id: 'reasoning_effort',
          name: 'Reasoning effort',
          category: 'thought_level',
          description: null,
          type: 'select',
          currentValue: 'medium',
          options: [
            {
              value: 'default',
              name: 'Default',
              group: null,
              description: null,
            },
            { value: 'low', name: 'Low', group: null, description: null },
            { value: 'medium', name: 'Medium', group: null, description: null },
            { value: 'high', name: 'High', group: null, description: null },
            {
              value: 'xhigh',
              name: 'Extra high',
              group: null,
              description: null,
            },
            { value: 'max', name: 'Max', group: null, description: null },
          ],
        }}
        value={effort()}
        onChange={(choice) => setEffort(choice.value)}
        speed={{ tier: 'ultrafast', enabled: fast(), onChange: setFast }}
      />
    </div>
  );
}
// #endregion

// #region demo:speeds
function SpeedsDemo() {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <SpeedToggle model={Model.gpt6Astra} /> GPT-6 Astra · 6×
      </div>
      <div class="flex items-center gap-3">
        <SpeedToggle model={Model.gpt61Sol} /> GPT-6.1 Sol · 6×
      </div>
      <div class="flex items-center gap-3">
        <SpeedToggle model={Model.opus55} /> Opus 5.5 · standard only
      </div>
      <div class="flex items-center gap-3">
        <SpeedToggle model={Model.sonnet55} /> Sonnet 5.5 · standard only
      </div>
    </div>
  );
}
// #endregion

export default defineDoc({
  name: 'AI effort and speed',
  category: 'Inputs',
  guidelines: {
    do: [
      'Combine agent effort and supported speed choices in one menu.',
      'Show the usage multiplier when offering accelerated model speeds.',
    ],
    dont: [
      'Show the lightning control for models that do not support fast mode.',
    ],
  },
  description:
    'Agent composers share one menu for effort and speed. Legacy chat keeps its persistent speed toggle.',
  demos: [
    {
      id: 'effort-and-speed',
      title: 'Combined agent settings',
      render: EffortAndSpeedDemo,
    },
    {
      id: 'speeds',
      title: 'Model speed support',
      render: SpeedsDemo,
    },
  ],
});
