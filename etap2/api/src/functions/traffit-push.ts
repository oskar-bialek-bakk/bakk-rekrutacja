import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import {
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

    try {
      const { resource } = await assessmentsContainer().item(body.assessmentId, user.upn).read();
      if (!resource) throw apiError(404, 'Assessment not found in user partition');
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 404) throw apiError(404, 'Assessment not found in user partition');
      throw cosmosErrorToApi(err);
    }

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
