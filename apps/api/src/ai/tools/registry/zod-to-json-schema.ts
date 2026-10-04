import type { ZodType } from 'zod';

/**
 * Minimal zod(v3) → JSON-Schema converter covering only the constructs our AI
 * tools use: object, string, number, boolean, enum, array, optional/default,
 * nullable and literal.
 *
 * A full converter (`zod-to-json-schema`) is intentionally NOT added as a
 * dependency; this keeps the AI boundary dependency-free and auditable. Zod is
 * pinned at ^3.23, whose `_def` shape is stable for these constructs.
 */

interface ZodDef {
  typeName?: string;
  shape?: () => Record<string, ZodType>;
  values?: readonly string[];
  type?: ZodType;
  innerType?: ZodType;
  value?: unknown;
  description?: string;
}

interface ZodLike {
  description?: string;
  _def?: ZodDef;
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaNode>;
  required: string[];
}

type JsonSchemaNode = Record<string, unknown>;

const OPTIONALISH = new Set(['ZodOptional', 'ZodDefault']);

export function zodToJsonSchema(schema: ZodType): JsonSchemaObject {
  const node = convert(schema as ZodLike);
  if (node.type !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }
  return node as unknown as JsonSchemaObject;
}

function convert(schema: ZodLike): JsonSchemaNode {
  const def = schema._def;
  const typeName = def?.typeName ?? '';
  const described = schema.description ?? def?.description;

  const withDescription = (node: JsonSchemaNode): JsonSchemaNode =>
    described ? { ...node, description: described } : node;

  switch (typeName) {
    case 'ZodObject': {
      const shape = def?.shape?.() ?? {};
      const properties: Record<string, JsonSchemaNode> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value as ZodLike);
        const inner = (value as ZodLike)._def?.typeName ?? '';
        if (!OPTIONALISH.has(inner)) required.push(key);
      }
      return withDescription({ type: 'object', properties, required });
    }
    case 'ZodString':
      return withDescription({ type: 'string' });
    case 'ZodNumber':
      return withDescription({ type: 'number' });
    case 'ZodBoolean':
      return withDescription({ type: 'boolean' });
    case 'ZodEnum':
      return withDescription({ type: 'string', enum: [...(def?.values ?? [])] });
    case 'ZodArray':
      return withDescription({ type: 'array', items: convert(def?.type as ZodLike) });
    case 'ZodOptional':
    case 'ZodDefault':
    case 'ZodNullable':
      return convert(def?.innerType as ZodLike);
    case 'ZodLiteral':
      return withDescription({ type: typeof def?.value, enum: [def?.value] });
    default:
      return withDescription({ type: 'string' });
  }
}
