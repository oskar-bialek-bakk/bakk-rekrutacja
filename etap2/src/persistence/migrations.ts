import type { Assessment } from '../domain/model';
import { SCHEMA_VERSION } from '../domain/model';

export function migrateAssessment(raw: any): Assessment {
  let a = raw;
  a.schemaVersion = SCHEMA_VERSION;
  return a as Assessment;
}
