import { describe, it, expect } from 'vitest';
import { rosterToCsv } from '../src/export/csv';
import type { RosterRow } from '../src/export/csv';

const BOM = '﻿';
const HEADER = 'Kandydat,Data,Etap I,Wynik II,Flagi czerwone,Flagi zielone,Decyzja';

function row(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    nameOrId: 'Jan Kowalski',
    date: '2026-06-08',
    stage1Result: '80%',
    score: 72,
    red: 1,
    green: 3,
    decision: 'yes',
    ...overrides,
  };
}

function stripBom(csv: string): string {
  return csv.startsWith(BOM) ? csv.slice(BOM.length) : csv;
}

function lines(csv: string): string[] {
  return stripBom(csv).split('\r\n');
}

describe('rosterToCsv structure', () => {
  it('output begins with a UTF-8 BOM', () => {
    expect(rosterToCsv([]).startsWith(BOM)).toBe(true);
  });

  it('first line is exactly the expected Polish header', () => {
    const header = lines(rosterToCsv([]))[0];
    expect(header).toBe(HEADER);
  });

  it('empty array returns BOM + header only (no data lines)', () => {
    const csv = rosterToCsv([]);
    expect(csv).toBe(BOM + HEADER + '\r\n');
  });

  it('uses CRLF as the record separator', () => {
    const csv = rosterToCsv([row()]);
    expect(csv).toContain('\r\n');
  });

  it('ends with a trailing CRLF after the last data row', () => {
    const csv = rosterToCsv([row()]);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('rosterToCsv row rendering', () => {
  it('renders columns in order with decision yes mapped to Tak', () => {
    const csv = rosterToCsv([row()]);
    const dataLine = lines(csv)[1];
    expect(dataLine).toBe('Jan Kowalski,2026-06-08,80%,72,1,3,Tak');
  });

  it('maps decision no to Nie', () => {
    const dataLine = lines(rosterToCsv([row({ decision: 'no' })]))[1];
    expect(dataLine.endsWith(',Nie')).toBe(true);
  });

  it('maps decision wait to Czekamy', () => {
    const dataLine = lines(rosterToCsv([row({ decision: 'wait' })]))[1];
    expect(dataLine.endsWith(',Czekamy')).toBe(true);
  });

  it('maps empty decision to an empty field', () => {
    const dataLine = lines(rosterToCsv([row({ decision: '' })]))[1];
    expect(dataLine.endsWith(',')).toBe(true);
  });

  it('maps unknown decision to an empty field', () => {
    const dataLine = lines(rosterToCsv([row({ decision: 'unknown' })]))[1];
    expect(dataLine.endsWith(',')).toBe(true);
  });

  it('renders one line per row', () => {
    const csv = rosterToCsv([row({ nameOrId: 'A' }), row({ nameOrId: 'B' })]);
    const dataLines = lines(csv).filter((l) => l.length > 0);
    expect(dataLines).toHaveLength(3);
  });
});

describe('rosterToCsv escaping (RFC 4180)', () => {
  it('wraps a field containing a comma in double quotes', () => {
    const dataLine = lines(rosterToCsv([row({ nameOrId: 'Kowal, Jan' })]))[1];
    expect(dataLine.startsWith('"Kowal, Jan",')).toBe(true);
  });

  it('doubles inner double quotes and quotes the field', () => {
    const dataLine = lines(rosterToCsv([row({ nameOrId: 'Jan "Janek" Kowal' })]))[1];
    expect(dataLine.startsWith('"Jan ""Janek"" Kowal",')).toBe(true);
  });

  it('quotes a field containing a newline', () => {
    const csv = rosterToCsv([row({ nameOrId: 'Line1\nLine2' })]);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('quotes a field containing a carriage return', () => {
    const csv = rosterToCsv([row({ stage1Result: 'a\rb' })]);
    expect(csv).toContain('"a\rb"');
  });

  it('passes Polish diacritics through unquoted', () => {
    const dataLine = lines(rosterToCsv([row({ nameOrId: 'Łukasz Żółć' })]))[1];
    expect(dataLine.startsWith('Łukasz Żółć,')).toBe(true);
    expect(dataLine).not.toContain('"');
  });
});

describe('rosterToCsv purity', () => {
  it('does not mutate the input rows', () => {
    const input = row({ decision: 'yes' });
    const snapshot = { ...input };
    rosterToCsv([input]);
    expect(input).toEqual(snapshot);
  });
});
