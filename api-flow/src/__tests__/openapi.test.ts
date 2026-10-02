import { describe, expect, it } from 'vitest';
import { app } from '../index';

describe('OpenAPI document', () => {
  it('preserves required gauges and the history query defaults', () => {
    const document = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Rivers.run Flow API', version: '1.0.0' },
    }) as any;
    const parameters = document.paths['/history'].get.parameters;
    const parameter = (name: string) => parameters.find((entry: any) => entry.name === name);

    expect(parameter('gauges')).toMatchObject({ in: 'query', required: true });
    expect(parameter('units').schema.default).toBe('default');
    expect(parameter('days').schema.default).toBe('7');

    const historyMapSchema = document.paths['/history'].get.responses['200']
      .content['application/json'].schema;
    expect(historyMapSchema).toMatchObject({ type: 'object' });

    const gaugeSchema = document.paths['/gauge/{prefix}/{id}'].get.responses['200']
      .content['application/json'].schema;
    expect(gaugeSchema.properties).toMatchObject({
      id: { type: 'string' },
      readings: { type: 'array' },
    });
  });
});
