import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
const app = new OpenAPIHono();
app.openapi(
    createRoute({
        method: 'get',
        path: '/test',
        middleware: [(c, next) => next()] as const,
        responses: { 200: { description: 'ok' } }
    }),
    (c) => c.json({})
);
