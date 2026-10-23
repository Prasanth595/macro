import type {
  LoroMapSchema,
  LoroTreeSchema,
  SchemaType,
  TreeNode,
} from '../schema/types';
import { assertSchemaValue, validateSchema } from '../schema/validators';

/** Reject unsupported values before a batch can write any CRDT operations. */
export function isJsonValue(
  value: unknown,
  ancestors = new Set<object>()
): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) =>
    isJsonValue(child, ancestors)
  );
  ancestors.delete(value);
  return valid;
}

export function validateTree<
  T extends LoroMapSchema<Record<string, SchemaType>>,
>(schema: LoroTreeSchema<T>, value: unknown): string[] {
  const ids = new Set<string>();
  const seen = new Set<object>();
  const errors: string[] = [];
  function visit(nodes: unknown) {
    if (!Array.isArray(nodes)) {
      errors.push('Tree children must be an array');
      return;
    }
    if (seen.has(nodes)) {
      errors.push('Tree contains a cycle or shared children');
      return;
    }
    seen.add(nodes);
    for (const node of nodes) {
      if (
        !node ||
        typeof node !== 'object' ||
        !('data' in node) ||
        !('children' in node)
      ) {
        errors.push('Tree nodes need data and children');
        continue;
      }
      if (seen.has(node)) {
        errors.push('Tree contains a cycle or duplicate node');
        continue;
      }
      seen.add(node);
      const data = node.data;
      const result = validateSchema(schema.nodeSchema, data);
      if (!data || !result.valid || !isJsonValue(data))
        errors.push(...(result.errors ?? ['Invalid tree node data']));
      else {
        assertSchemaValue(schema.nodeSchema, data);
        const id = schema.idSelector(data);
        if (typeof id !== 'string' || !id || ids.has(id))
          errors.push('Tree IDs must be nonempty and unique');
        ids.add(id);
      }
      visit(node.children);
    }
  }
  visit(value);
  return errors;
}

export function assertTree<T extends LoroMapSchema<Record<string, SchemaType>>>(
  schema: LoroTreeSchema<T>,
  value: unknown
): asserts value is TreeNode<import('../schema/types').InferType<T>>[] {
  const errors = validateTree(schema, value);
  if (errors.length) throw new Error(`Invalid tree: ${errors.join(', ')}`);
}

/** Structural checks still apply when optional scalar validation is disabled. */
export function validateProposedTrees(
  schema: SchemaType | undefined,
  value: unknown
): void {
  if (!schema) return;
  if (schema.type === 'loro-tree') {
    assertTree(schema, value);
    return;
  }
  if (value === undefined || value === null) return;
  if (
    (schema.type === 'schema' || schema.type === 'loro-map') &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    for (const [key, field] of Object.entries(schema.definition)) {
      if (key in value) {
        const child: unknown = Reflect.get(value, key);
        if (child === undefined && schema.type === 'loro-map') continue;
        validateProposedTrees(field, child);
      } else if (schema.type === 'schema' && field.type === 'loro-tree') {
        throw new Error(
          'Native root trees cannot be removed; use an empty forest'
        );
      }
    }
  } else if (
    (schema.type === 'loro-list' || schema.type === 'loro-movable-list') &&
    Array.isArray(value)
  ) {
    for (const item of value) validateProposedTrees(schema.itemSchema, item);
  }
}
