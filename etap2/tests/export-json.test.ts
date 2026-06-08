import { describe, it, expect } from 'vitest';
import { serializeAssessment, serializeAll, parseImport } from '../src/export/json';
import { createEmptyAssessment } from '../src/domain/model';
import type { Assessment } from '../src/domain/model';

function sample(id: string, name: string): Assessment {
  const base = createEmptyAssessment(id, {
    nameOrId: name,
    date: '2026-06-08',
    stage1Result: '80%',
    stage1Note: '',
  });
  return {
    ...base,
    marks: { ...base.marks, A: 4 },
    decision: 'yes',
    negotiation: { ...base.negotiation, widelki: '8-10k' },
  };
}

describe('serializeAssessment / serializeAll', () => {
  it('serializeAssessment produces pretty-printed valid JSON', () => {
    const a = sample('a', 'Jan');
    const text = serializeAssessment(a);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain('\n');
  });

  it('serializeAll produces pretty-printed valid JSON', () => {
    const text = serializeAll([sample('a', 'Jan'), sample('b', 'Ola')]);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain('\n');
    expect(Array.isArray(JSON.parse(text))).toBe(true);
  });
});

describe('parseImport round-trip', () => {
  it('round-trip single returns one record with key fields', () => {
    const a = sample('a', 'Jan');
    const result = parseImport(serializeAssessment(a));
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.id).toBe('a');
    expect(r.candidate.nameOrId).toBe('Jan');
    expect(r.marks.A).toBe(4);
    expect(r.decision).toBe('yes');
    expect(r.negotiation.widelki).toBe('8-10k');
  });

  it('round-trip all returns two records with matching ids', () => {
    const a = sample('a', 'Jan');
    const b = sample('b', 'Ola');
    const result = parseImport(serializeAll([a, b]));
    expect(result.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('wraps a single object into a one-element array', () => {
    const result = parseImport('{"id":"x"}');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('x');
  });

  it('returns fully-formed Assessments with defaults filled', () => {
    const result = parseImport('{"id":"x"}');
    const r = result[0];
    expect(r.marks).toEqual({});
    expect(r.negotiation).toBeDefined();
    expect(r.negotiation.widelki).toBe('');
    expect(typeof r.schemaVersion).toBe('number');
  });
});

describe('parseImport validation', () => {
  it('throws on invalid JSON', () => {
    expect(() => parseImport('{ not json')).toThrow('Nieprawidłowy plik JSON (nie udało się sparsować).');
  });

  it('throws format error on a JSON number', () => {
    expect(() => parseImport('42')).toThrow('Nieprawidłowy format importu: oczekiwano oceny lub listy ocen.');
  });

  it('throws format error on a JSON string', () => {
    expect(() => parseImport('"hello"')).toThrow('Nieprawidłowy format importu: oczekiwano oceny lub listy ocen.');
  });

  it('throws format error on a JSON null', () => {
    expect(() => parseImport('null')).toThrow('Nieprawidłowy format importu: oczekiwano oceny lub listy ocen.');
  });

  it('throws id error on array entry with empty object', () => {
    expect(() => parseImport('[{}]')).toThrow('Nieprawidłowy rekord w imporcie: brak poprawnego pola id.');
  });

  it('throws id error on array entry with non-string id', () => {
    expect(() => parseImport('[{"id": 123}]')).toThrow('Nieprawidłowy rekord w imporcie: brak poprawnego pola id.');
  });

  it('throws id error on array entry with whitespace-only id', () => {
    expect(() => parseImport('[{"id": "   "}]')).toThrow('Nieprawidłowy rekord w imporcie: brak poprawnego pola id.');
  });
});
