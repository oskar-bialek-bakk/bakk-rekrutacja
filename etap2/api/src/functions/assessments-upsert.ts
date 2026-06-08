import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { apiError, cosmosErrorToApi, errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import { AssessmentSchema, StoredAssessment } from '../lib/schemas.js';

export async function assessmentsUpsert(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const id = req.params.id;
    if (!id) throw apiError(400, 'Missing id');

    const body = await parseJsonBody(req, AssessmentSchema);
    if (body.id !== id) throw apiError(400, 'Body id does not match URL id');

    const container = assessmentsContainer();

    // Check ownership if existing doc, prevent overwriting other user's data
    let createdAt = body.createdAt;
    try {
      const { resource: existing } = await container.item(id, user.upn).read<StoredAssessment>();
      if (existing) {
        createdAt = existing.createdAt;
      }
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code !== 404) throw cosmosErrorToApi(err);
    }

    // Cross-partition search: if same id exists under different upn, reject
    const { resources: collisions } = await container.items
      .query({
        query: 'SELECT c.userPrincipalName FROM c WHERE c.id = @id AND c.userPrincipalName != @upn',
        parameters: [
          { name: '@id', value: id },
          { name: '@upn', value: user.upn },
        ],
      })
      .fetchAll();
    if (collisions.length > 0) {
      throw apiError(403, 'Assessment with this id belongs to another user');
    }

    const stored: StoredAssessment = {
      ...body,
      userPrincipalName: user.upn,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    try {
      const { resource } = await container.items.upsert(stored);
      return jsonResponse(200, resource);
    } catch (err) {
      throw cosmosErrorToApi(err);
    }
  } catch (err) {
    ctx.error('assessmentsUpsert failed', err);
    return errorResponse(err);
  }
}

app.http('assessments-upsert', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'v1/assessments/{id}',
  handler: assessmentsUpsert,
});
