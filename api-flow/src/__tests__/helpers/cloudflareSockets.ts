// Stand-in for the workerd-only `cloudflare:sockets` module under Node vitest.
// Tests that need a socket replace it with vi.mock.
export function connect(): never {
    throw new Error('cloudflare:sockets is unavailable outside workerd');
}
