import {
  clause,
  compileClause,
  confine,
  type TargetExpr,
} from '@app/features/soup/filters';
import type { SoupAstItemsQueryArgs } from '@queries/soup/items';

/**
 * The owner's chats and agent sessions, newest first. Routine runs pile up
 * fast, so they are left out unless asked for.
 */
export function agentConversationsQuery(
  ownerId: string,
  options: { showRoutineRuns: boolean }
): SoupAstItemsQueryArgs {
  const sessions: TargetExpr[] = [
    clause.eq('includeAgentSessions', true),
    clause.eq('agentSessionOwnerId', ownerId),
  ];
  if (!options.showRoutineRuns) {
    sessions.push(clause.not(clause.eq('agentSessionSource', 'routine')));
  }
  return {
    params: { expand: true, sort_method: 'updated_at', limit: 100 },
    body: compileClause(
      confine({
        cf: clause.eq('chatOwnerId', ownerId),
        asf: clause.and(...sessions),
      })
    ),
  };
}
