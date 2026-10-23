import { readMe } from '@directus/sdk';
import type { DirectusUser, Query } from '@directus/sdk';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { directus } from '@/lib/directus';
import type { DirectusSchema } from '@/lib/directus';

/** Authenticated Directus user exposed to the UI. */
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  /**
   * Role slug (`employee` | `manager` | `rh` | `admin`), read from the expanded
   * `directus_roles.name`. `ProtectedRoute` compares it with the route's `role`
   * prop.
   */
  role: string | null;
}

/**
 * Query type required by `readMe` until the real Directus schema is generated
 * (TDD Fase 3+). It pins the SDK generics to the placeholder schema.
 */
type CurrentUserQuery = Query<DirectusSchema, DirectusUser<DirectusSchema>>;

/** Slice of the store written to `localStorage` so the session survives reloads. */
interface PersistedAuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthState extends PersistedAuthState {
  /** `true` once `hydrate()`/`login()` confirmed a valid session. */
  isAuthenticated: boolean;
  /**
   * `true` until hydration/validation finishes. `ProtectedRoute` must render a
   * loading indicator while this is `true` to avoid a "not authenticated" flash.
   */
  isLoading: boolean;
  /** Last authentication error, surfaced by the login screen. */
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Accepts both a bare role name and an expanded M2O object. Directus roles are
 * named with the TDD slugs (`employee`, `manager`, `rh`, `admin`), so the name
 * can be compared directly by `ProtectedRoute`.
 */
function readRoleName(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const name = (value as Record<string, unknown>)['name'];
    return typeof name === 'string' && name.length > 0 ? name : null;
  }

  return null;
}

/** Narrows the Directus payload to the fields consumed by the UI. */
function toUser(value: unknown): User {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Directus returned an invalid user payload.');
  }

  const record = value as Record<string, unknown>;
  const id = record['id'];

  return {
    id: typeof id === 'string' ? id : String(id ?? ''),
    email: readString(record, 'email'),
    first_name: readString(record, 'first_name'),
    last_name: readString(record, 'last_name'),
    role: readRoleName(record['role']),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const payload = (error as { errors?: { message?: unknown }[] }).errors;
    const first = Array.isArray(payload) ? payload[0]?.message : undefined;

    if (typeof first === 'string' && first.length > 0) {
      return first;
    }

    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unexpected authentication error.';
}

async function fetchCurrentUser(): Promise<User> {
  // `role.name` is expanded so the store keeps the role slug instead of its id.
  const data = await directus.request(
    readMe<DirectusSchema, CurrentUserQuery>({ fields: ['*', 'role.name'] }),
  );
  return toUser(data);
}

/**
 * Directus authentication store.
 *
 * The SDK (`@/lib/directus`) persists the raw tokens in `directus.auth` so
 * `getToken()`/`refresh()` keep working after a reload; this store keeps the
 * `user` + tokens mirrored in `auth-storage` for the UI and validates the
 * session on boot through `hydrate()`.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      /** Clears both the local state and the SDK session. */
      const clearSession = async (): Promise<void> => {
        try {
          await directus.logout();
        } catch {
          // Best effort: the local session is cleared even if the API fails.
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      };

      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        // Starts `true` so consumers never assume a logged-out state before
        // `hydrate()` had a chance to restore the persisted session.
        isLoading: true,
        error: null,

        login: async (email, password) => {
          set({ isLoading: true, error: null });

          try {
            const session = await directus.login({ email, password });
            const user = await fetchCurrentUser();

            set({
              user,
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const message = toErrorMessage(error);
            await clearSession();
            set({ error: message });
            throw new Error(message);
          }
        },

        logout: clearSession,

        refresh: async () => {
          const { refreshToken } = get();

          if (!refreshToken) {
            throw new Error('No refresh token available. Please sign in again.');
          }

          try {
            const session = await directus.refresh();

            set({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            });
          } catch (error) {
            const message = toErrorMessage(error);
            await clearSession();
            set({ error: message });
            throw new Error(message);
          }
        },

        hydrate: async () => {
          // `persist` restores tokens asynchronously; wait for it before
          // deciding whether a session exists.
          if (!useAuthStore.persist.hasHydrated()) {
            await new Promise<void>((resolve) => {
              const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
                unsubscribe();
                resolve();
              });
            });
          }

          // Already validated by `login()` or a previous hydration.
          if (get().isAuthenticated) {
            set({ isLoading: false });
            return;
          }

          if (!get().accessToken) {
            set({ user: null, isAuthenticated: false, isLoading: false, error: null });
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const user = await fetchCurrentUser();
            set({ user, isAuthenticated: true, isLoading: false, error: null });
          } catch {
            try {
              await get().refresh();
              const user = await fetchCurrentUser();
              set({ user, isAuthenticated: true, isLoading: false, error: null });
            } catch {
              // `refresh()` already cleared the session on failure; auto-logout
              // must not surface an error on boot.
              set({ isAuthenticated: false, isLoading: false, error: null });
            }
          }
        },
      };
    },
    {
      name: 'auth-storage',
      storage: createJSONStorage<PersistedAuthState>(() => window.localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
