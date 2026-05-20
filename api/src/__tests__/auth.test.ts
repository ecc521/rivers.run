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

describe('API Key Middleware Bypasses', () => {
    test('Official Origin bypasses api key check', async () => {
        let calledNext = false;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'https://rivers.run';
                    return null;
                }
            }
        };
        const next = async () => { calledNext = true; };
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('Localhost Origin bypasses api key check', async () => {
        let calledNext = false;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'http://localhost:5173';
                    return null;
                }
            }
        };
        const next = async () => { calledNext = true; };
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('Localhost with different port bypasses api key check', async () => {
        let calledNext = false;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'http://localhost:3000';
                    return null;
                }
            }
        };
        const next = async () => { calledNext = true; };
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('Capacitor Origin bypasses api key check', async () => {
        let calledNext = false;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'capacitor://app.rivers.run';
                    return null;
                }
            }
        };
        const next = async () => { calledNext = true; };
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('Subdomain Origin bypasses api key check', async () => {
        let calledNext = false;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'https://app.rivers.run';
                    return null;
                }
            }
        };
        const next = async () => { calledNext = true; };
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(calledNext).toBe(true);
    });

    test('Non-official request without key gets rejected with 401', async () => {
        let returnCode = 0;
        let returnData: any = null;
        const fakeContext: any = {
            req: {
                header: (name: string) => {
                    const normalized = name.toLowerCase();
                    if (normalized === 'origin') return 'https://malicious.website';
                    return null;
                }
            },
            json: (data: any, code: number) => {
                returnCode = code;
                returnData = data;
                return { data, code };
            }
        };
        const next = async () => {};
        
        const { apiKeyMetadataMiddleware } = await import('../auth');
        await apiKeyMetadataMiddleware(fakeContext, next);
        expect(returnCode).toBe(401);
        expect(returnData.error).toContain('Missing API key');
    });
});
