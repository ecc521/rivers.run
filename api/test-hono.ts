import { createRoute } from '@hono/zod-openapi';
const route = createRoute({
    method: 'get',
    path: '/test',
    middleware: [async (c, next) => next()] as const,
    responses: { 200: { description: 'ok' } }
});
