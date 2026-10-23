import type { CommandInputSession } from '../context/command-input';
import { UniversalInputFixture } from './fixture';

/** Real composer/controller with the fixture's recording-only destination adapters. */
export function CommandUniversalInput(props: CommandInputSession) {
  return <UniversalInputFixture embedded command={props} />;
}
