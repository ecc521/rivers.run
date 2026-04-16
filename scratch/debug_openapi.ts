import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import app from './api/src/index.ts';

try {
    const openApiConfig = {
        openapi: '3.1.0',
        info: { title: 'Rivers.run API', version: '1.0.0' },
        security: [{ bearerAuth: [] }]
    };
    // @ts-ignore
    const doc = app.getOpenAPI31Document(openApiConfig);
    console.log("OpenAPI Document generated successfully");
} catch (e) {
    console.error("OpenAPI Generation Failed:");
    console.error(e);
    process.exit(1);
}
