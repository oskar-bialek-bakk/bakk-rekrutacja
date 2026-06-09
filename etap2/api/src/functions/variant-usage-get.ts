import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { variantUsageContainer } from '../lib/cosmos.js';
import { cosmosErrorToApi, errorResponse, jsonResponse } from '../lib/http.js';

const GLOBAL_USAGE_DOC = {
  id: 'global',
  scope: 'global',
  counts: {
    A: [0, 0, 0, 0],
    B: [0, 0, 0],
    C: [0, 0, 0, 0, 0],
    D: [0, 0, 0],
  },
};

export async function variantUsageGet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireUser(req);
    const container = variantUsageContainer();
    try {
      const { resource } = await container.item('global', 'global').read();
      if (resource) return jsonResponse(200, resource);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code !== 404) throw cosmosErrorToApi(err);
      // fall through to seed
    }
    // Lazy seed - tworzy global doc gdy brak (zamiast 404 ktore mylacy dla AzureStore)
    try {
      const { resource } = await container.items.create(GLOBAL_USAGE_DOC);
      return jsonResponse(200, resource ?? GLOBAL_USAGE_DOC);
    } catch (createErr) {
      const code = (createErr as { code?: number }).code;
      if (code === 409) {
        // race condition - inny request zaseedował, re-read
        const { resource } = await container.item('global', 'global').read();
        return jsonResponse(200, resource ?? GLOBAL_USAGE_DOC);
      }
      throw cosmosErrorToApi(createErr);
    }
  } catch (err) {
    ctx.error('variantUsageGet failed', err);
    return errorResponse(err);
  }
}

app.http('variant-usage-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/variant-usage',
  handler: variantUsageGet,
});
