import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import {
  TraffitLoginError,
  TraffitNotConfiguredError,
  TraffitSessionExpiredError,
  createTraffitClient,
  readConfig,
} from '../lib/traffit-client.js';

export async function traffitCandidates(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireUser(req);
    const config = readConfig();
    if (!config) throw new TraffitNotConfiguredError();

    const client = createTraffitClient(config);
    const candidates = await client.listBkCandidates();
    return jsonResponse(200, { candidates });
  } catch (err) {
    if (err instanceof TraffitNotConfiguredError) {
      ctx.warn('Traffit candidates attempted but not configured');
      return jsonResponse(501, { error: err.message });
    }
    if (err instanceof TraffitSessionExpiredError) {
      ctx.warn(err.message);
      return jsonResponse(502, { error: err.message });
    }
    if (err instanceof TraffitLoginError) {
      ctx.error('Traffit login failed', err);
      return jsonResponse(502, { error: `Traffit login: ${err.message}` });
    }
    ctx.error('traffitCandidates failed', err);
    return errorResponse(err);
  }
}

app.http('traffit-candidates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/traffit/candidates',
  handler: traffitCandidates,
});
