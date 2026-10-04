import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AiToolRiskLevel, type AiToolDefinition } from '@medu/contracts';
import { ToolRegistryService } from '../tool-registry.service';
import { zodToJsonSchema } from '../zod-to-json-schema';

const tool = (name: string, requiresConfirmation = false): AiToolDefinition => ({
  name,
  description: `tool ${name}`,
  inputSchema: z.object({ search: z.string().optional() }),
  riskLevel: AiToolRiskLevel.LOW,
  requiresConfirmation,
  permission: 'students:read',
  execute: async () => ({ ok: true }),
});

describe('ToolRegistryService', () => {
  it('registers, lists and resolves tools', () => {
    const registry = new ToolRegistryService([tool('students.search'), tool('teachers.list')]);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('students.search')?.name).toBe('students.search');
    expect(registry.require('teachers.list').name).toBe('teachers.list');
  });

  it('rejects duplicate tool names', () => {
    expect(() => new ToolRegistryService([tool('dup'), tool('dup')])).toThrow(/Duplicate/);
  });

  it('throws a typed error for an unknown tool', () => {
    const registry = new ToolRegistryService([]);
    expect(() => registry.require('nope')).toThrow(/does not exist/);
  });

  it('exposes provider tool descriptors with JSON schemas', () => {
    const registry = new ToolRegistryService([tool('students.search')]);
    const [descriptor] = registry.toProviderTools();
    expect(descriptor.name).toBe('students.search');
    expect(descriptor.parameters).toMatchObject({ type: 'object' });
  });
});

describe('zodToJsonSchema', () => {
  it('maps objects, optionals, enums and arrays', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().optional(),
      day: z.enum(['MONDAY', 'FRIDAY']),
      tags: z.array(z.string()),
    });
    const json = zodToJsonSchema(schema);
    expect(json.type).toBe('object');
    expect(json.required).toEqual(['name', 'day', 'tags']);
    expect(json.properties.name).toMatchObject({ type: 'string' });
    expect(json.properties.day).toMatchObject({ enum: ['MONDAY', 'FRIDAY'] });
    expect(json.properties.tags).toMatchObject({ type: 'array' });
  });
});
