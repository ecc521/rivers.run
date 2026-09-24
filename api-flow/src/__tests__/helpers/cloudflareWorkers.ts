// Stand-in for the workerd-only `cloudflare:workers` module under Node vitest,
// enough for @cloudflare/containers to import. Tests never start a container.
export class DurableObject {
    constructor(public ctx: unknown, public env: unknown) {}
}
export class WorkerEntrypoint {
    constructor(public ctx: unknown, public env: unknown) {}
}
