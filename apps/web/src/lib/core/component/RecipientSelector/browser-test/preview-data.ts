export * from '../../../context/user';
// This fixture has no signed-in user or DM history. The recipient control is real.
export const useUserId = () => () => undefined;
export const useEmail = () => () => undefined;
export const useAugmentUserWithDmActivity =
  () =>
  <T>(user: T): T =>
    user;
