import {
  canDuplicateItemType,
  FOLDER_DUPLICATE_LIMIT_HINT,
} from '@core/component/FileList/itemOperations';
import { toast } from '@core/component/Toast/Toast';
import type { EntityData } from '@entity';
import { createBulkCopyDssEntityMutation } from '@entity';
import type { EntityActionListState } from './entity-action-context';

export const makeCopyAction = () => {
  const bulkCopyMutation = createBulkCopyDssEntityMutation();

  // The types the copy mutation duplicates; it rejects any other.
  const canExecute = (entity: EntityData): boolean =>
    (entity.type === 'document' ||
      entity.type === 'chat' ||
      entity.type === 'project') &&
    canDuplicateItemType(entity.type);

  const execute = async (entities: EntityData[]) => {
    try {
      await bulkCopyMutation.mutateAsync({
        entities,
        name: (name) => name,
      });
    } catch {
      toast.failure(
        entities.length > 1 ? 'Unable to copy items' : 'Unable to copy item',
        entities.some((entity) => entity.type === 'project')
          ? { subtext: FOLDER_DUPLICATE_LIMIT_HINT }
          : undefined
      );
      return;
    }
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
