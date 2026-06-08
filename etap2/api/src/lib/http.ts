import type { HttpResponseInit } from '@azure/functions';
import type { z } from 'zod';

export interface ApiError extends Error {
  status: number;
  details?: unknown;
}

export function apiError(status: number, message: string, details?: unknown): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.details = details;
  return err;
}

export function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
  };
}

export function errorResponse(err: unknown): HttpResponseInit {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as ApiError).status === 'number') {
    const apiErr = err as ApiError;
    return jsonResponse(apiErr.status, {
      error: apiErr.message,
      details: apiErr.details,
    });
  }
  const msg = err instanceof Error ? err.message : 'Internal error';
  return jsonResponse(500, { error: msg });
}

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: { json: () => Promise<unknown> },
  schema: T
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw apiError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw apiError(400, 'Validation failed', result.error.flatten());
  }
  return result.data;
}

/** Maps Cosmos SDK error codes to HTTP status. */
export function cosmosErrorToApi(err: unknown): ApiError {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: number }).code;
    if (code === 404) return apiError(404, 'Not found');
    if (code === 409) return apiError(409, 'Conflict');
    if (code === 412) return apiError(412, 'Precondition failed');
  }
  const msg = err instanceof Error ? err.message : 'Cosmos error';
  return apiError(500, msg);
}
