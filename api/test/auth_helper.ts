import { vi } from "vitest";

let testPrivateKey: CryptoKey;
let testPublicKeyJwk: any;

export function base64UrlEncode(arr: Uint8Array): string {
    const binString = Array.from(arr, byte => String.fromCharCode(byte)).join("");
    return btoa(binString)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export async function initAuthMock() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: { name: "SHA-256" }
        },
        true,
        ["sign", "verify"]
    ) as CryptoKeyPair;
    testPrivateKey = keyPair.privateKey;
    testPublicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    testPublicKeyJwk.kid = "test-key-id";
    testPublicKeyJwk.alg = "RS256";
    testPublicKeyJwk.use = "sig";

    // Spy on global fetch to return our test JWK
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("googleapis.com")) {
            return {
                json: async () => ({ keys: [testPublicKeyJwk] })
            } as any;
        }
        return { json: async () => ({}) } as any;
    });
}

export async function createTestJwt(userId: string) {
    const payload = {
        sub: userId,
        user_id: userId,
        aud: "rivers-run",
        iss: "https://securetoken.google.com/rivers-run",
        exp: Math.floor(Date.now() / 1000) + 3600
    };

    const header = {
        alg: "RS256",
        kid: "test-key-id",
        typ: "JWT"
    };

    const encoder = new TextEncoder();
    const headerPart = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const dataToSign = encoder.encode(`${headerPart}.${payloadPart}`);

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        testPrivateKey,
        dataToSign
    );

    const signaturePart = base64UrlEncode(new Uint8Array(signature));
    return `Bearer ${headerPart}.${payloadPart}.${signaturePart}`;
}
