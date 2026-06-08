import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse } from '../lib/http.js';

export async function assessmentsGet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const id = req.params.id;
    if (!id) throw apiError(400, 'Missing id');

    const scope = req.query.get('scope') === 'team' ? 'team' : 'mine';
    const container = assessmentsContainer();

    if (scope === 'mine') {
      try {
        const { resource } = await container.item(id, user.upn).read();
        if (!resource) throw apiError(404, 'Not found');
        return jsonResponse(200, resource);
      } catch (err) {
        throw cosmosErrorToApi(err);
      }
    }

    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }],
      })
      .fetchAll();
    if (resources.length === 0) throw apiError(404, 'Not found');
    return jsonResponse(200, resources[0]);
  } catch (err) {
    ctx.error('assessmentsGet failed', err);
    return errorResponse(err);
  }
}

app.http('assessments-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/assessments/{id}',
  handler: assessmentsGet,
});
