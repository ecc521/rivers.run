import { describe, expect, it } from 'vitest';
import app from '../index';

describe('OpenAPI document', () => {
  it('describes subscription notification states as a string-to-boolean record', async () => {
    const response = await app.request('/openapi.json');
    expect(response.status).toBe(200);

    const document = await response.json() as any;
    const responseSchema = document.paths['/user/subscriptions'].get.responses['200']
      .content['application/json'].schema;
    const schema = responseSchema.properties?.notificationStates;

    expect(document.openapi).toBe('3.0.0');
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: { type: 'boolean' },
    });

    const riversSchema = document.paths['/rivers'].get.responses['200']
      .content['application/json'].schema;
    expect(riversSchema.type).toBe('array');
    expect(riversSchema.items.properties).toMatchObject({
      id: { type: 'string' },
      name: { type: 'string' },
      accessPoints: { type: 'array' },
    });
  });
});
