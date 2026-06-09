import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getCurrentUser } from '../lib/auth.js';
import { pingCosmos, variantUsageContainer } from '../lib/cosmos.js';

const GLOBAL_USAGE_DOC = {
  id: 'global',
  scope: 'global',
  counts: {
    A: [0, 0, 0, 0],
    B: [0, 0, 0],
    C: [0, 0, 0, 0, 0],
    D: [0, 0, 0],
  },
};

async function ensureGlobalUsageSeeded(): Promise<'created' | 'exists'> {
  const container = variantUsageContainer();
  try {
    await container.item('global', 'global').read();
    return 'exists';
  } catch (err) {
    const status = (err as { code?: number }).code;
    if (status === 404) {
      await container.items.create(GLOBAL_USAGE_DOC);
      return 'created';
    }
    throw err;
  }
}

export async function health(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const user = getCurrentUser(req);
  const result: Record<string, unknown> = {
    ok: true,
    user: user?.upn ?? null,
    timestamp: new Date().toISOString(),
  };

  try {
    await pingCosmos();
    result.cosmos = 'reachable';
  } catch (err) {
    ctx.error('Cosmos ping failed', err);
    result.cosmos = 'unreachable';
    result.ok = false;
  }

  if (result.cosmos === 'reachable') {
    try {
      result.variantUsageSeed = await ensureGlobalUsageSeeded();
    } catch (err) {
      ctx.error('variantUsage seed failed', err);
      result.variantUsageSeed = 'error';
    }
  }

  return {
    status: result.ok ? 200 : 503,
    jsonBody: result,
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: health,
});
