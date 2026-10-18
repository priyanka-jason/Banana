import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Checking who is signed in.
 *
 * Shoppers sign in on the website with Google or Apple through Supabase Auth. Supabase
 * then gives the browser a login token (a JWT: a short piece of signed text saying
 * "this is user 1234, valid until 3 pm"). The website sends it to our API in the header
 *   Authorization: Bearer <token>
 * and this file checks the signature against Supabase's published public keys before
 * trusting the user id inside. We never see a password, and we never store or log the token.
 */

/** The signed-in shopper, as far as our API needs to know. */
export interface SignedInUser {
  /** Supabase Auth's id for the person (auth.users.id). */
  id: string;
}

export interface TokenVerifier {
  /** The user the token belongs to, or undefined if it is missing, forged, expired or not a signed-in user. */
  verify(token: string): Promise<SignedInUser | undefined>;
}

/** Real tokens are about 1 KB. Anything far bigger is not worth reading. */
const MAX_TOKEN_LENGTH = 8 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface KeyVerifierOptions {
  /** Where the public keys come from. */
  keys: JWTVerifyGetKey;
  /** Who must have issued the token, e.g. https://<project>.supabase.co/auth/v1 */
  issuer: string;
}

/** Checks tokens against a set of public keys. Tests pass their own keys; the app uses createSupabaseVerifier. */
export function createKeyVerifier(options: KeyVerifierOptions): TokenVerifier {
  return {
    async verify(token) {
      if (token === '' || token.length > MAX_TOKEN_LENGTH) return undefined;
      try {
        const { payload } = await jwtVerify(token, options.keys, {
          issuer: options.issuer,
          audience: 'authenticated',
          // Supabase signs with ES256 (or RS256). Shared-secret and unsigned tokens are refused.
          algorithms: ['ES256', 'RS256'],
          clockTolerance: 5,
        });
        // Signed-out visitors get "anon" tokens with no user in them; only signed-in users count.
        if (payload['role'] !== 'authenticated') return undefined;
        if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) return undefined;
        return { id: payload.sub.toLowerCase() };
      } catch {
        // Bad signature, expired, wrong issuer... The reason isn't passed on: it could echo the token.
        return undefined;
      }
    },
  };
}

/**
 * Checks tokens issued by a Supabase project, using the public keys Supabase publishes at
 * <project URL>/auth/v1/.well-known/jwks.json. The keys are fetched once and cached.
 * Only the project URL is needed: no secret key.
 */
export function createSupabaseVerifier(projectUrl: string): TokenVerifier {
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    throw new Error('SUPABASE_URL must be the project URL, like https://abcdefgh.supabase.co');
  }
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must start with https://');
  const base = url.origin;
  return createKeyVerifier({
    keys: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)),
    issuer: `${base}/auth/v1`,
  });
}

/** The token from an "Authorization: Bearer <token>" header, or undefined. */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match?.[1];
}
