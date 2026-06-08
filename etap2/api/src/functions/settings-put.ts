import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { settingsContainer } from '../lib/cosmos.js';
import { cosmosErrorToApi, errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import { SettingsInputSchema, StoredSettings } from '../lib/schemas.js';

export async function settingsPut(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const body = await parseJsonBody(req, SettingsInputSchema);

    const stored: StoredSettings = {
      userPrincipalName: user.upn,
      ...body,
    };
    const doc = { id: user.upn, ...stored };

    try {
      const { resource } = await settingsContainer().items.upsert(doc);
      return jsonResponse(200, resource);
    } catch (err) {
      throw cosmosErrorToApi(err);
    }
  } catch (err) {
    ctx.error('settingsPut failed', err);
    return errorResponse(err);
  }
}

app.http('settings-put', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'v1/settings',
  handler: settingsPut,
});
