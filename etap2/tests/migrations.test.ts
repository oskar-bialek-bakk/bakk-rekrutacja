import { describe, it, expect } from 'vitest';
import { migrateAssessment } from '../src/persistence/migrations';
import { SCHEMA_VERSION } from '../src/domain/model';

describe('migrateAssessment v1 → v2', () => {
  it('surowy rekord schemaVersion=1 bez blockTimes dostaje blockTimes:{} i schemaVersion=2', () => {
    const raw = {
      id: 'x',
      schemaVersion: 1,
      candidate: { nameOrId: 'A', date: '2026-06-08', stage1Result: '', stage1Note: '' },
    };
    const out = migrateAssessment(raw);
    expect(out.schemaVersion).toBe(2);
    expect(SCHEMA_VERSION).toBe(2);
    expect(out.blockTimes).toEqual({});
  });

  it('zachowuje istniejący blockTimes jeśli jest', () => {
    const raw = {
      id: 'x',
      schemaVersion: 2,
      blockTimes: { A: { spentSec: 42 } },
    };
    const out = migrateAssessment(raw);
    expect(out.blockTimes).toEqual({ A: { spentSec: 42 } });
  });

  it('odrzuca ujemny / niefinitywny spentSec (clamp do 0)', () => {
    const raw = {
      id: 'x',
      schemaVersion: 2,
      blockTimes: {
        A: { spentSec: -100 },
        B: { spentSec: Number.NaN },
        C: { spentSec: Number.POSITIVE_INFINITY },
        D: { spentSec: 30 },
      },
    };
    const out = migrateAssessment(raw);
    expect(out.blockTimes.A?.spentSec).toBe(0);
    expect(out.blockTimes.B?.spentSec).toBe(0);
    expect(out.blockTimes.C?.spentSec).toBe(0);
    expect(out.blockTimes.D?.spentSec).toBe(30);
  });
});
