import { expect, test, describe } from 'vitest';
import { requireAdmin, requireModerator } from '../auth';

describe('Auth Role Boundaries', () => {
    test('requireAdmin rejects standard user with 403', async () => {
        let returnCode = 0;
        const fakeContext: any = {
            get: (key: string) => {
                if (key === 'user') return { d1Role: 'user' };
                return null;
            },
            json: (data: any, code: number) => {
                returnCode = code;
                return { data, code };
            }
        };
        const next = async () => {};
        
        await requireAdmin(fakeContext, next);
        expect(returnCode).toBe(403);
    });

    test('requireModerator rejects standard user with 403', async () => {
        let returnCode = 0;
        const fakeContext: any = {
            get: (key: string) => {
                if (key === 'user') return { d1Role: 'user' };
                return null;
            },
            json: (data: any, code: number) => {
                returnCode = code;
                return { data, code };
            }
        };
        const next = async () => {};
        
        await requireModerator(fakeContext, next);
        expect(returnCode).toBe(403);
    });

    test('requireModerator allows moderator role', async () => {
        let calledNext = false;
        const fakeContext: any = {
            get: (key: string) => {
                if (key === 'user') return { d1Role: 'moderator' };
                return null;
            },
            json: (data: any, code: number) => {
                return { data, code };
            }
        };
        const next = async () => { calledNext = true; };
        
        await requireModerator(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('requireModerator allows admin role (escalation fallback)', async () => {
        let calledNext = false;
        const fakeContext: any = {
            get: (key: string) => {
                if (key === 'user') return { d1Role: 'admin' };
                return null;
            },
            json: (data: any, code: number) => {
                return { data, code };
            }
        };
        const next = async () => { calledNext = true; };
        
        await requireModerator(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('requireAdmin allows admin role', async () => {
        let calledNext = false;
        const fakeContext: any = {
            get: (key: string) => {
                if (key === 'user') return { d1Role: 'admin' };
                return null;
            },
            json: (data: any, code: number) => {
                return { data, code };
            }
        };
        const next = async () => { calledNext = true; };
        
        await requireAdmin(fakeContext, next);
        expect(calledNext).toBe(true);
    });
});
