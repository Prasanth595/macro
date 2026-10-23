import { expect, it } from 'vitest';
import { experimentalFeaturesAvailable } from './access';

it.each([
  ['alice@macro.com', true, true],
  ['ALICE@MACRO.COM', true, true],
  ['alice@macro.com', false, false],
  ['alice@example.com', true, false],
  ['alice@macro.com.evil.com', true, false],
  ['alice@notmacro.com', true, false],
  [undefined, true, false],
] as const)('gates %s with rollout %s', (email, flag, expected) => {
  expect(experimentalFeaturesAvailable(email, flag)).toBe(expected);
});
