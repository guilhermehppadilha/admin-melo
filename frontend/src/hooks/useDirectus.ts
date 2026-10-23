import {
  createItem,
  deleteItem,
  readItem,
  readItems,
  updateItem,
} from '@directus/sdk';
import type { Query, QueryItem } from '@directus/sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { directus } from '@/lib/directus';
import type { DirectusSchema } from '@/lib/directus';

/** Primary key accepted by Directus items. */
export type DirectusId = string | number;

/** Item shape produced by the schema-less client. */
type DirectusRow = Record<string, unknown>;

/**
 * `TQuery` variants required by the SDK commands. The concrete schema is not
 * generated yet, so the schema-aware query types cannot be used directly;
 * these aliases pin the SDK generics to the placeholder schema.
 */
type DirectusReadQuery = Query<DirectusSchema, DirectusRow>;
type DirectusReadItemQuery = QueryItem<DirectusSchema, DirectusRow>;
type DirectusMutationQuery = Query<DirectusSchema, DirectusRow[]>;

/**
 * Query options accepted by the read hooks. Mirrors the subset of Directus
 * REST query parameters the app needs.
 */
export interface DirectusQueryOptions {
  readonly fields?: readonly string[];
  readonly filter?: Record<string, unknown>;
  readonly search?: string;
  readonly sort?: string | readonly string[];
  readonly limit?: number;
  readonly offset?: number;
  readonly page?: number;
  readonly deep?: Record<string, unknown>;
}

const DIRECTUS_KEY = 'directus';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortKeys(record[key]);
        return sorted;
      }, {});
  }
  return value;
}

/**
 * Deterministic serialization used inside query keys, so semantically equal
 * query options share the same cache entry regardless of key order.
 */
function serializeQuery(query?: DirectusQueryOptions): string {
  if (query === undefined) {
    return '';
  }
  return JSON.stringify(sortKeys(query));
}

/**
 * Query keys for the Directus layer.
 *
 * - collection prefix: `['directus', 'collection', <collection>]`
 * - list:              `[...prefix, 'list', <serialized query>]`
 * - item:              `[...prefix, 'item', <id>]`
 *
 * Invalidating the collection prefix therefore refreshes every list and item
 * query of that collection.
 */
export const directusKeys = {
  all: [DIRECTUS_KEY] as const,
  collection: (collection: string) =>
    [DIRECTUS_KEY, 'collection', collection] as const,
  list: (collection: string, query?: DirectusQueryOptions) =>
    [DIRECTUS_KEY, 'collection', collection, 'list', serializeQuery(query)] as const,
  item: (collection: string, id: DirectusId) =>
    [DIRECTUS_KEY, 'collection', collection, 'item', String(id)] as const,
};

/** Forward a schema-less query object to an SDK command. */
function toSdkQuery(query?: DirectusQueryOptions): DirectusReadQuery {
  return query as unknown as DirectusReadQuery;
}

/**
 * List the items of a collection.
 */
export function useDirectusCollection<T>(
  collection: string,
  query?: DirectusQueryOptions,
): UseQueryResult<T[], Error> {
  return useQuery<T[], Error>({
    queryKey: directusKeys.list(collection, query),
    queryFn: async () => {
      const data = await directus.request(
        readItems<DirectusSchema, string, DirectusReadQuery>(
          collection,
          toSdkQuery(query),
        ),
      );
      return data as unknown as T[];
    },
  });
}

/**
 * Read a single item of a collection.
 */
export function useDirectusItem<T>(
  collection: string,
  id: DirectusId,
): UseQueryResult<T, Error> {
  return useQuery<T, Error>({
    queryKey: directusKeys.item(collection, id),
    queryFn: async () => {
      const data = await directus.request(
        readItem<DirectusSchema, string, DirectusReadItemQuery>(collection, id),
      );
      return data as unknown as T;
    },
  });
}

/**
 * Create an item and refresh every query of its collection on success.
 */
export function useDirectusCreate<T>(
  collection: string,
): UseMutationResult<T, Error, Partial<T>> {
  const queryClient = useQueryClient();

  return useMutation<T, Error, Partial<T>>({
    mutationFn: async (payload) => {
      const data = await directus.request(
        createItem<DirectusSchema, string, DirectusMutationQuery>(
          collection,
          payload as unknown as DirectusRow,
        ),
      );
      return data as unknown as T;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: directusKeys.collection(collection),
      });
    },
  });
}

/** Variables accepted by {@link useDirectusUpdate}. */
export interface DirectusUpdateVariables<T> {
  readonly id: DirectusId;
  readonly data: Partial<T>;
}

/**
 * Update an item and refresh every query of its collection on success.
 */
export function useDirectusUpdate<T>(
  collection: string,
): UseMutationResult<T, Error, DirectusUpdateVariables<T>> {
  const queryClient = useQueryClient();

  return useMutation<T, Error, DirectusUpdateVariables<T>>({
    mutationFn: async ({ id, data }) => {
      const updated = await directus.request(
        updateItem<DirectusSchema, string, DirectusMutationQuery, DirectusRow>(
          collection,
          id,
          data as unknown as DirectusRow,
        ),
      );
      return updated as unknown as T;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: directusKeys.collection(collection),
      });
    },
  });
}

/**
 * Delete an item and refresh every query of its collection on success.
 */
export function useDirectusDelete(
  collection: string,
): UseMutationResult<void, Error, DirectusId> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DirectusId>({
    mutationFn: async (id) => {
      await directus.request(deleteItem<DirectusSchema, string>(collection, id));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: directusKeys.collection(collection),
      });
    },
  });
}
