import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth.js';
import { assessmentsContainer } from '../lib/cosmos.js';
import { errorResponse, jsonResponse } from '../lib/http.js';

export async function assessmentsList(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireUser(req);
    const scope = req.query.get('scope') === 'team' ? 'team' : 'mine';

    const container = assessmentsContainer();
    if (scope === 'mine') {
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.userPrincipalName = @upn ORDER BY c.updatedAt DESC',
          parameters: [{ name: '@upn', value: user.upn }],
        }, { partitionKey: user.upn })
        .fetchAll();
      return jsonResponse(200, { scope, assessments: resources });
    }

    const { resources } = await container.items
      .query('SELECT * FROM c ORDER BY c.updatedAt DESC')
      .fetchAll();
    return jsonResponse(200, { scope, assessments: resources });
  } catch (err) {
    ctx.error('assessmentsList failed', err);
    return errorResponse(err);
  }
}

app.http('assessments-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'v1/assessments',
  handler: assessmentsList,
});
