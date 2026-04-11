import { describe, expect, it } from 'vitest';
import contracts from './schemas/api-contracts.json';
import featureInventory from '../src/shared/feature-inventory.json';
import { workerFetch } from './helpers';

type JsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: string[];
  enum?: string[];
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

function assertSchema(value: unknown, schema: JsonSchema, at = '$'): void {
  if (schema.type === 'object') {
    expect(typeof value, `${at} should be an object`).toBe('object');
    expect(value, `${at} should not be null`).not.toBeNull();

    const objectValue = value as Record<string, unknown>;
    for (const required of schema.required || []) {
      expect(Object.prototype.hasOwnProperty.call(objectValue, required), `${at}.${required} is required`).toBe(true);
    }

    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
        assertSchema(objectValue[key], childSchema, `${at}.${key}`);
      }
    }
    return;
  }

  if (schema.type === 'array') {
    expect(Array.isArray(value), `${at} should be an array`).toBe(true);
    if (schema.items) {
      for (const [index, item] of (value as unknown[]).entries()) {
        assertSchema(item, schema.items, `${at}[${index}]`);
      }
    }
    return;
  }

  if (schema.type === 'string') {
    expect(typeof value, `${at} should be a string`).toBe('string');
    if (schema.pattern) {
      expect(new RegExp(schema.pattern).test(value as string), `${at} should match ${schema.pattern}`).toBe(true);
    }
    if (schema.enum) {
      expect(schema.enum.includes(value as string), `${at} should be one of ${schema.enum.join(', ')}`).toBe(true);
    }
    return;
  }

  if (schema.type === 'number') {
    expect(typeof value, `${at} should be a number`).toBe('number');
    return;
  }

  if (schema.type === 'boolean') {
    expect(typeof value, `${at} should be a boolean`).toBe('boolean');
  }
}

describe('api contracts', () => {
  it('enforces need-* feature ID shape in shared inventory', () => {
    const pattern = new RegExp(contracts.featureIdPattern);
    for (const id of featureInventory.allNeedIds) {
      expect(pattern.test(id), `feature id should match contract: ${id}`).toBe(true);
    }
  });

  it('validates vote endpoint response contract', async () => {
    const featureId = `need-contract-${crypto.randomUUID().replace(/[^a-z0-9-]/g, '').slice(0, 12)}`;
    const response = await workerFetch(`/api/vote/${featureId}/up`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.21' }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    assertSchema(data, contracts.voteResponse);
  });

  it('validates auth me response contract', async () => {
    const response = await workerFetch('/api/auth/me');
    expect(response.status).toBe(200);
    const data = await response.json();
    assertSchema(data, contracts.authMeResponse);
  });

  it('validates votes collection response values', async () => {
    const featureId = `need-contract-${crypto.randomUUID().replace(/[^a-z0-9-]/g, '').slice(0, 12)}`;
    await workerFetch(`/api/vote/${featureId}/down`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.22' }
    });

    const response = await workerFetch('/api/votes');
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(data, featureId)).toBe(true);
    assertSchema(data[featureId], contracts.votesCollectionValue, `$.${featureId}`);

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('need-')) {
        expect(new RegExp(contracts.featureIdPattern).test(key)).toBe(true);
      }
      assertSchema(value, contracts.votesCollectionValue, `$.${key}`);
    }
  });
});
