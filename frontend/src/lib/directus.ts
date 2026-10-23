import { authentication, createDirectus, rest } from '@directus/sdk';
import type { AuthenticationData, AuthenticationStorage } from '@directus/sdk';

/**
 * Placeholder Directus schema used until the real schema is generated
 * (TDD Fase 3+). Every collection is described as a list of records with
 * unknown fields, which keeps the client typed as `Record<string, unknown>`
 * instead of the SDK's untyped default.
 *
 * Replace this with the generated schema type once it exists.
 */
export type DirectusSchema = Record<string, Record<string, unknown>[]>;

/**
 * Directus base URL, e.g. `https://intranet.mook.tech/api`.
 * Configure it in `frontend/.env` (see `frontend/.env.example`).
 */
const directusUrl = import.meta.env.VITE_DIRECTUS_URL as string | undefined;

if (!directusUrl) {
  throw new Error(
    'VITE_DIRECTUS_URL is not defined. Copy frontend/.env.example to frontend/.env and set the Directus URL.',
  );
}

/** `localStorage` key holding the Directus session (tokens + expiry). */
export const AUTH_STORAGE_KEY = 'directus.auth';

/**
 * Persistent authentication storage for the SDK.
 *
 * The SDK default keeps the session in memory, so a page reload would drop the
 * refresh token and `refresh()` (and the automatic renewal performed by
 * `getToken()`) would stop working. Backing it with `localStorage` keeps the
 * session alive across reloads.
 */
const authStorage: AuthenticationStorage = {
  get: () => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthenticationData;
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  },
  set: (value) => {
    if (value) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  },
};

/**
 * Shared Directus client (JSON authentication + REST).
 *
 * A single instance must be reused across the app: `authentication('json')`
 * keeps the access token in this client, so every hook request inherits it.
 */
export const directus = createDirectus<DirectusSchema>(directusUrl)
  .with(authentication('json', { storage: authStorage }))
  .with(rest());
