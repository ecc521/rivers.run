import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc } from 'firebase/firestore';
import { readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testEnv;

beforeAll(async () => {
    // Initialize the test environment using the local firestore emulator and our rules
    testEnv = await initializeTestEnvironment({
        projectId: "rivers-run",
        firestore: {
            rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'),
            host: "127.0.0.1",
            port: 8080,
        },
    });
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

afterAll(async () => {
    await testEnv.cleanup();
});

describe("Local Security Rules Validation", () => {
    
    // Test 1: Anonymous users cannot write to the master rivers collection
    test("Public anonymous users CAN read rivers but CANNOT write", async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        
        // Assert native read access
        await assertSucceeds(getDoc(doc(unauthedDb, "rivers", "public-river-1")));
        
        // Assert write blocking
        await assertFails(setDoc(doc(unauthedDb, "rivers", "malicious-river"), { name: "Hacked!" }));
    });

    // Test 2: Logged in, but email NOT verified -> Still allowed to submit to queue
    test("Unverified User CAN submit to review queue", async () => {
        const unverifiedContext = testEnv.authenticatedContext("pleb-user", {
            email: "pleb@gmail.com",
            email_verified: false
        });
        const unverifiedDb = unverifiedContext.firestore();
        
        await assertSucceeds(setDoc(doc(unverifiedDb, "reviewQueue", "new-river"), { name: "Nice River" }));
    });

    // Test 3: Verified pleb user -> Can write to queue, cannot write to rivers
    test("Verified User CAN submit to queue but CANNOT publish direct to rivers", async () => {
        const verifiedContext = testEnv.authenticatedContext("good-pleb", {
            email: "good@gmail.com",
            email_verified: true
        });
        const plebDb = verifiedContext.firestore();
        
        // Assert succeeds dropping into review queue
        await assertSucceeds(setDoc(doc(plebDb, "reviewQueue", "legit-sub"), { name: "Cool River" }));
        
        // Assert fails bypassing queue entirely
        await assertFails(setDoc(doc(plebDb, "rivers", "hacked-river"), { name: "Hacked directly" }));
    });

    // Test 4: Fully Verified Admin User -> Unrestricted DB Access
    test("Authorized Admin CAN read queue and CAN publish directly to rivers", async () => {
        // First we must execute as a backdoor system admin to artificially seed an admin
        // We use testEnv.withSecurityRulesDisabled to inject the fake admin UID doc natively
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const backdoorDb = context.firestore();
            await setDoc(doc(backdoorDb, "users", "admin-uid-123"), { isAdmin: true });
        });

        // Now authenticate under that injected Admin UID context
        const adminContext = testEnv.authenticatedContext("admin-uid-123", {
            email: "admin@rivers.run",
            email_verified: true
        });
        
        const adminDb = adminContext.firestore();

        // Admin read queue
        await assertSucceeds(getDoc(doc(adminDb, "reviewQueue", "some-queue-item")));
        
        // Admin direct write to live production collection
        await assertSucceeds(setDoc(doc(adminDb, "rivers", "golden-river"), { name: "Approved River!" }));
    });
});
