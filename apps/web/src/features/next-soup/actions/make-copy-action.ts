import { toast } from '@core/component/Toast/Toast';
import type { EntityData } from '@entity';
import { createBulkCopyDssEntityMutation } from '@entity';
import type { EntityActionListState } from './entity-action-context';

export const makeCopyAction = () => {
  const bulkCopyMutation = createBulkCopyDssEntityMutation();

  // The types the copy mutation duplicates; it rejects any other.
  const canExecute = (entity: EntityData): boolean => {
    return entity.type === 'document' || entity.type === 'chat';
  };

  const execute = async (entities: EntityData[]) => {
    await bulkCopyMutation.mutateAsync({
      entities,
      name: (name) => name,
    });
    toast.success(
      entities.length > 1 ? `Copied ${entities.length} items` : 'Copied'
    );
  };

  const executeWithSoup = async (
    entities: EntityData[],
    soup: EntityActionListState
  ) => {
    await execute(entities);
    soup.selection.clear();
  };

  return { canExecute, execute, executeWithSoup };
};
