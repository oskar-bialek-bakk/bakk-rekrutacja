import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import {
  TraffitLoginError,
  TraffitNotConfiguredError,
  TraffitSessionExpiredError,
  createTraffitClient,
  readConfig,
} from '../lib/traffit-client.js';

const BodySchema = z.object({
  assessmentId: z.string().min(1),
  employeeId: z.number().int().positive(),
  html: z.string().min(1),
});

export async function traffitPush(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const config = readConfig();
    if (!config) throw new TraffitNotConfiguredError();

    const body = await parseJsonBody(req, BodySchema);

    let resource: unknown;
    try {
      ({ resource } = await assessmentsContainer().item(body.assessmentId, user.upn).read());
    } catch (err) {
      const e = err as { code?: number | string; statusCode?: number };
      // Brak dokumentu w partycji użytkownika: traktuj jak 404 poniżej.
      // Każdy inny błąd Cosmos mapujemy normalnie (nie maskuj 500 jako 404).
      if (e.code === 404 || e.code === 'NotFound' || e.statusCode === 404) {
        resource = undefined;
      } else {
        throw cosmosErrorToApi(err);
      }
    }
    // Rzucamy POZA blokiem try, żeby ten apiError(404) nie został złapany i
    // przemapowany przez cosmosErrorToApi na 500 (dawny błąd: status 500 zamiast 404).
    if (!resource) throw apiError(404, 'Assessment not found in user partition');

    const client = createTraffitClient(config);
    const result = await client.pushAssessmentNote({
      employeeId: body.employeeId,
      assessmentId: body.assessmentId,
      html: body.html,
    });
    return jsonResponse(200, result);
  } catch (err) {
    if (err instanceof TraffitNotConfiguredError) {
      ctx.warn('Traffit push attempted but not configured');
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
    ctx.error('traffitPush failed', err);
    return errorResponse(err);
  }
}

app.http('traffit-push', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'v1/traffit/push',
  handler: traffitPush,
});
