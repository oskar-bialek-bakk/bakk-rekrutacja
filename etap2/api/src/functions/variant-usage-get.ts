import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { variantUsageContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse } from '../lib/http.js';

export async function variantUsageGet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireUser(req);
    try {
      const { resource } = await variantUsageContainer().item('global', 'global').read();
      if (!resource) throw apiError(404, 'variantUsage.global not seeded');
      return jsonResponse(200, resource);
    } catch (err) {
      throw cosmosErrorToApi(err);
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
