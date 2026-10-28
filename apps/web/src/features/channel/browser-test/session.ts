import { createSignal } from 'solid-js';

// Only the session/navigation boundary is replaced; menus and editor are real.
export const [initialInput, setInitialInput] = createSignal<string>();
export async function openChatWithInput(input: string) {
  setInitialInput(input);
}

export { default as ChatWithAgentIcon } from '@icon/system/regular/sparkle.svg';
export const ChatWithAgentButton = () => null;
export const AskMacroButton = () => null;
export async function openChatWithAgent() {
  return false;
}
export const openChatWithMessage = openChatWithInput;
export const openChatWithInputReplacingSplit = openChatWithInput;
export const openChatWithMessageReplacingSplit = openChatWithInput;
