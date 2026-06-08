import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse } from '../lib/http.js';

export async function assessmentsDelete(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const id = req.params.id;
    if (!id) throw apiError(400, 'Missing id');

    const container = assessmentsContainer();
    try {
      await container.item(id, user.upn).delete();
      return { status: 204 };
    } catch (err) {
      throw cosmosErrorToApi(err);
    }
  } catch (err) {
    ctx.error('assessmentsDelete failed', err);
    return errorResponse(err);
  }
}

app.http('assessments-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'v1/assessments/{id}',
  handler: assessmentsDelete,
});
