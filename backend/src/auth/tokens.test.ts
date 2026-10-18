import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearerToken, createKeyVerifier, createSupabaseVerifier, type TokenVerifier } from './tokens';

const ISSUER = 'https://example-project.supabase.co/auth/v1';
const USER_ID = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc';

let verifier: TokenVerifier;
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  otherPrivateKey = (await generateKeyPair('ES256')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'ES256' };
  verifier = createKeyVerifier({ keys: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });
});

async function token(
  claims: JWTPayload = {},
  options: { key?: CryptoKey; issuer?: string; audience?: string; expires?: string | number } = {},
): Promise<string> {
  return new SignJWT({ role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(typeof claims.sub === 'string' ? claims.sub : USER_ID)
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(options.expires ?? '1h')
    .sign(options.key ?? privateKey);
}

describe('createKeyVerifier', () => {
  it('accepts a valid token for a signed-in user', async () => {
    expect(await verifier.verify(await token())).toEqual({ id: USER_ID });
  });

  it('refuses tokens that are forged, expired, for someone else, or not a signed-in user', async () => {
    const refused = [
      await token({}, { key: otherPrivateKey }),
      await token({}, { expires: Math.floor(Date.now() / 1000) - 60 }),
      await token({}, { issuer: 'https://evil.example.com/auth/v1' }),
      await token({}, { audience: 'someone-else' }),
      await token({ role: 'anon' }),
      await token({ sub: 'not-a-uuid' }),
      'not.a.token',
      '',
      'x'.repeat(9000),
    ];
    for (const value of refused) expect(await verifier.verify(value)).toBeUndefined();
  });

  it('refuses unsigned tokens', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none' })}.${encode({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', iss: ISSUER })}.`;
    expect(await verifier.verify(unsigned)).toBeUndefined();
  });
});

describe('createSupabaseVerifier', () => {
  it('needs an https project URL', () => {
    expect(() => createSupabaseVerifier('not a url')).toThrow('SUPABASE_URL');
    expect(() => createSupabaseVerifier('http://example.supabase.co')).toThrow('https://');
    expect(() => createSupabaseVerifier('https://example.supabase.co')).not.toThrow();
  });
});

describe('bearerToken', () => {
  it('reads "Bearer <token>" and nothing else', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken(undefined)).toBeUndefined();
    expect(bearerToken('Basic abc')).toBeUndefined();
    expect(bearerToken('Bearer a b')).toBeUndefined();
  });
});
