import { createContext, useContext } from 'solid-js';
import type { ItemFact } from './run-cards';

const NONE: ReadonlyMap<string, ItemFact> = new Map();

/**
 * What the reply a view sits in did to each item, by `itemKey`, so a card
 * the view shows for one of them says it: `Created`, `Sent`. The facts come
 * from the steps that did it, never from the view the model wrote. Outside
 * an agent's reply there are none.
 */
export const ItemFacts = createContext<() => ReadonlyMap<string, ItemFact>>(
  () => NONE
);

/** The facts of the reply this component sits in. */
export function useItemFacts(): () => ReadonlyMap<string, ItemFact> {
  return useContext(ItemFacts);
}
