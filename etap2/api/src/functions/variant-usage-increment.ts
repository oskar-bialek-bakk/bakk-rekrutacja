import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PatchOperation } from '@azure/cosmos';
import { requireUser } from '../lib/auth.js';
import { variantUsageContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import { VariantUsageIncrementSchema } from '../lib/schemas.js';

export async function variantUsageIncrement(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireUser(req);
    const { block, variantIdx } = await parseJsonBody(req, VariantUsageIncrementSchema);

    const path = `/counts/${block}/${variantIdx}`;
    const ops: PatchOperation[] = [{ op: 'incr', path, value: 1 }];

    try {
      const { resource } = await variantUsageContainer()
        .item('global', 'global')
        .patch(ops);
      return jsonResponse(200, resource);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 412 || code === 400) {
        throw apiError(400, `Index ${variantIdx} out of range for block ${block} (or doc not seeded yet)`, err);
      }
      throw cosmosErrorToApi(err);
    }
  } catch (err) {
    ctx.error('variantUsageIncrement failed', err);
    return errorResponse(err);
  }
}

app.http('variant-usage-increment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/variant-usage/increment',
  handler: variantUsageIncrement,
});
