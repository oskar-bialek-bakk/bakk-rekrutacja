import type { Decision } from '../domain/model';

export interface RosterRow {
  nameOrId: string;
  date: string;
  stage1Result: string;
  score: number;
  red: number;
  green: number;
  decision: Decision | '';
}

const BOM = '﻿';
const CRLF = '\r\n';
const COLUMNS = [
  'Kandydat',
  'Data',
  'Etap I',
  'Wynik II',
  'Flagi czerwone',
  'Flagi zielone',
  'Decyzja',
] as const;
const HEADER = COLUMNS.join(',');

const DECISION_LABELS: Record<Decision, string> = {
  yes: 'Tak',
  no: 'Nie',
  wait: 'Czekamy',
};

function escapeField(value: string): string {
  const needsQuoting =
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\r') ||
    value.includes('\n');
  if (!needsQuoting) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function mapDecision(decision: Decision | ''): string {
  return DECISION_LABELS[decision as Decision] ?? '';
}

function rowToLine(row: RosterRow): string {
  const fields = [
    row.nameOrId,
    row.date,
    row.stage1Result,
    String(row.score),
    String(row.red),
    String(row.green),
    mapDecision(row.decision),
  ];
  return fields.map(escapeField).join(',');
}

export function rosterToCsv(rows: RosterRow[]): string {
  const dataLines = rows.map(rowToLine);
  const allLines = [HEADER, ...dataLines];
  return BOM + allLines.join(CRLF) + CRLF;
}
