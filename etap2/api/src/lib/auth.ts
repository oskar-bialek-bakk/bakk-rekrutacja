import type { HttpRequest } from '@azure/functions';

export interface CurrentUser {
  upn: string;
  oid: string;
  name: string;
}

interface ClientPrincipal {
  auth_typ?: string;
  name_typ?: string;
  role_typ?: string;
  claims?: Array<{ typ: string; val: string }>;
}

const UPN_CLAIM_TYPES = new Set([
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
  'preferred_username',
  'upn',
  'email',
]);

const OID_CLAIM_TYPES = new Set([
  'http://schemas.microsoft.com/identity/claims/objectidentifier',
  'oid',
  'sub',
]);

const NAME_CLAIM_TYPES = new Set([
  'name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
]);

function decodePrincipal(headerValue: string): ClientPrincipal | null {
  try {
    const json = Buffer.from(headerValue, 'base64').toString('utf8');
    return JSON.parse(json) as ClientPrincipal;
  } catch {
    return null;
  }
}

function findClaim(principal: ClientPrincipal, types: Set<string>): string | null {
  if (!principal.claims) return null;
  for (const claim of principal.claims) {
    if (types.has(claim.typ)) return claim.val;
  }
  return null;
}

/**
 * Reads identity from Easy Auth headers injected by Azure App Service / Function App
 * after JWT validation. Falls back to MOCK_USER_* env vars in local dev
 * (set in local.settings.json).
 */
export function getCurrentUser(req: HttpRequest): CurrentUser | null {
  const upnHeader = req.headers.get('x-ms-client-principal-name');
  const oidHeader = req.headers.get('x-ms-client-principal-id');
  const principalHeader = req.headers.get('x-ms-client-principal');

  if (upnHeader && oidHeader) {
    let name = upnHeader;
    if (principalHeader) {
      const principal = decodePrincipal(principalHeader);
      if (principal) {
        name = findClaim(principal, NAME_CLAIM_TYPES) ?? upnHeader;
      }
    }
    return { upn: upnHeader, oid: oidHeader, name };
  }

  if (principalHeader) {
    const principal = decodePrincipal(principalHeader);
    if (principal && principal.claims) {
      const upn = findClaim(principal, UPN_CLAIM_TYPES);
      const oid = findClaim(principal, OID_CLAIM_TYPES);
      const name = findClaim(principal, NAME_CLAIM_TYPES) ?? upn ?? null;
      if (upn && oid && name) return { upn, oid, name };
    }
  }

  const mockUpn = process.env.MOCK_USER_UPN;
  const mockOid = process.env.MOCK_USER_OID;
  if (mockUpn && mockOid) {
    return {
      upn: mockUpn,
      oid: mockOid,
      name: process.env.MOCK_USER_NAME ?? mockUpn,
    };
  }

  return null;
}

export function requireUser(req: HttpRequest): CurrentUser {
  const user = getCurrentUser(req);
  if (!user) {
    const err: Error & { status?: number } = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return user;
}
