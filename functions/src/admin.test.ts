import * as fftest from 'firebase-functions-test';

// Mock firebase-admin before importing the code under test
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}));

const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockDocSet = jest.fn();
const mockAddLog = jest.fn();

jest.mock('firebase-admin/auth', () => ({
    getAuth: jest.fn(() => ({
        setCustomUserClaims: mockSetCustomUserClaims,
        getUser: mockGetUser,
    })),
}));

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: mockDocSet,
            })),
            add: mockAddLog,
        })),
    })),
}));

// Import the functions (Note: we need to handle the v2 imports properly in tests)
// Since we are unit testing the logic, we can often just test the inner function if exported, 
// or use fftest.wrap.
import * as myFunctions from './index';

// @ts-expect-error Namespace lack of signature from fake import
const testEnv = (fftest.default ? fftest.default() : fftest());

describe('Admin Role Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('adminSetRole hierarchy and stripping', () => {
        const adminSetRole = testEnv.wrap(myFunctions.adminSetRole);

        it('should allow SuperAdmin to demote Admin to Moderator and strip Admin claims', async () => {
            // Setup: Target is an Admin
            mockGetUser.mockResolvedValue({
                uid: 'target-123',
                customClaims: { admin: true, moderator: true }
            });

            const context = {
                auth: {
                    uid: 'super-admin-uid',
                    token: { superAdmin: true, email: 'tucker@example.com' }
                }
            };

            await adminSetRole({ targetUid: 'target-123', role: 'moderator' }, context);

            // Verify: setCustomUserClaims was called with ONLY moderator: true
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target-123', { moderator: true });
            
            // Verify: Firestore legacy flag was kept as true (since they are still a moderator)
            expect(mockDocSet).toHaveBeenCalledWith({ isAdmin: true }, { merge: true });
        });

        it('should allow SuperAdmin to drop Admin to none and strip all claims', async () => {
            mockGetUser.mockResolvedValue({
                uid: 'target-123',
                customClaims: { admin: true, moderator: true }
            });

            const context = {
                auth: {
                    uid: 'super-admin-uid',
                    token: { superAdmin: true }
                }
            };

            await adminSetRole({ targetUid: 'target-123', role: 'none' }, context);

            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target-123', {});
            expect(mockDocSet).toHaveBeenCalledWith({ isAdmin: false }, { merge: true });
        });

        it('should block an Admin from modifying a SuperAdmin', async () => {
            // Setup: Target is a SuperAdmin
            mockGetUser.mockResolvedValue({
                uid: 'super-admin-123',
                customClaims: { superAdmin: true }
            });

            const context = {
                auth: {
                    uid: 'regular-admin-uid',
                    token: { admin: true }
                }
            };

            // This should throw a permission-denied error (verifySuperAdmin fails)
            await expect(adminSetRole({ targetUid: 'super-admin-123', role: 'moderator' }, context))
                .rejects.toThrow(/SuperAdmin role required/);
        });

        it('should block an Admin from modifying another Admin', async () => {
             mockGetUser.mockResolvedValue({
                uid: 'admin-2',
                customClaims: { admin: true }
            });

            const context = {
                auth: {
                    uid: 'admin-1',
                    token: { admin: true }
                }
            };

            await expect(adminSetRole({ targetUid: 'admin-2', role: 'none' }, context))
                .rejects.toThrow(/SuperAdmin role required/);
        });
    });

    describe('Security Patch: Banned Users', () => {
        const adminSetRole = testEnv.wrap(myFunctions.adminSetRole);
        const adminBanUser = testEnv.wrap(myFunctions.adminBanUser);

        it('should block a Banned Admin from calling admin functions', async () => {
            const context = {
                auth: {
                    uid: 'banned-admin-uid',
                    token: { admin: true, banned: true }
                }
            };

            await expect(adminSetRole({ targetUid: 'any', role: 'none' }, context))
                .rejects.toThrow(/User is banned/);
        });

        it('should allow SuperAdmin to ban an Admin and strip their roles', async () => {
            mockGetUser.mockResolvedValue({
                uid: 'target-admin',
                customClaims: { admin: true, moderator: true }
            });

            const context = {
                auth: {
                    uid: 'super-admin-uid',
                    token: { superAdmin: true }
                }
            };

            await adminBanUser({ targetUid: 'target-admin', banned: true }, context);

            // Verify: claims were set to { banned: true } and roles were deleted
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target-admin', { banned: true });
            expect(mockDocSet).toHaveBeenCalledWith({ isAdmin: false }, { merge: true });
        });

        it('should prevent banning a SuperAdmin directly', async () => {
            mockGetUser.mockResolvedValue({
                uid: 'target-super',
                customClaims: { superAdmin: true }
            });

            const context = {
                auth: {
                    uid: 'another-super-uid',
                    token: { superAdmin: true }
                }
            };

            await expect(adminBanUser({ targetUid: 'target-super', banned: true }, context))
                .rejects.toThrow(/Cannot ban a superAdmin directly/);
        });
    });
});
