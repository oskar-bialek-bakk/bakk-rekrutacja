import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentUser } from '../src/lib/auth.js';

function fakeReq(headers: Record<string, string>): { headers: { get: (k: string) => string | null } } {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null },
  };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getCurrentUser', () => {
  it('reads upn + oid from Easy Auth headers', () => {
    const req = fakeReq({
      'x-ms-client-principal-name': 'alice@bakk.com',
      'x-ms-client-principal-id': 'abc-123',
    });
    expect(getCurrentUser(req as never)).toEqual({
      upn: 'alice@bakk.com',
      oid: 'abc-123',
      name: 'alice@bakk.com',
    });
  });

  it('uses display name from base64 principal claims when present', () => {
    const principal = {
      claims: [
        { typ: 'name', val: 'Alice Smith' },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(principal), 'utf8').toString('base64');
    const req = fakeReq({
      'x-ms-client-principal-name': 'alice@bakk.com',
      'x-ms-client-principal-id': 'abc-123',
      'x-ms-client-principal': encoded,
    });
    expect(getCurrentUser(req as never)?.name).toBe('Alice Smith');
  });

  it('falls back to principal-only claims when upn/oid headers missing', () => {
    const principal = {
      claims: [
        { typ: 'preferred_username', val: 'bob@bakk.com' },
        { typ: 'oid', val: 'oid-bob' },
        { typ: 'name', val: 'Bob' },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(principal), 'utf8').toString('base64');
    const req = fakeReq({ 'x-ms-client-principal': encoded });
    expect(getCurrentUser(req as never)).toEqual({
      upn: 'bob@bakk.com',
      oid: 'oid-bob',
      name: 'Bob',
    });
  });

  it('returns MOCK_USER_* env values when no Easy Auth headers and no principal', () => {
    process.env.MOCK_USER_UPN = 'dev@bakk.com';
    process.env.MOCK_USER_OID = 'mock-oid';
    process.env.MOCK_USER_NAME = 'Dev User';
    const req = fakeReq({});
    expect(getCurrentUser(req as never)).toEqual({
      upn: 'dev@bakk.com',
      oid: 'mock-oid',
      name: 'Dev User',
    });
  });

  it('returns null when no headers and no mock env', () => {
    delete process.env.MOCK_USER_UPN;
    delete process.env.MOCK_USER_OID;
    const req = fakeReq({});
    expect(getCurrentUser(req as never)).toBeNull();
  });

  it('ignores malformed base64 principal header', () => {
    const req = fakeReq({ 'x-ms-client-principal': 'not-valid-base64-json' });
    expect(getCurrentUser(req as never)).toBeNull();
  });
});
