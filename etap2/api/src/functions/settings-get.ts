import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { settingsContainer } from '../lib/cosmos.js';
import { cosmosErrorToApi, errorResponse, jsonResponse } from '../lib/http.js';

export async function settingsGet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    try {
      const { resource } = await settingsContainer().item(user.upn, user.upn).read();
      if (!resource) {
        return jsonResponse(200, null);
      }
      return jsonResponse(200, resource);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 404) return jsonResponse(200, null);
      throw cosmosErrorToApi(err);
    }
  } catch (err) {
    ctx.error('settingsGet failed', err);
    return errorResponse(err);
  }
}

app.http('settings-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/settings',
  handler: settingsGet,
});
