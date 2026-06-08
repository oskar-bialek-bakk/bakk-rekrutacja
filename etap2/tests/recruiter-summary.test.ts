import { describe, it, expect } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import type { Assessment, Settings } from '../src/domain/model';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';
import { buildRecruiterSummary } from '../src/domain/recruiter-summary';

function settings(): Settings {
  return { weights: { ...DEFAULT_WEIGHTS }, showScoreLive: false, includeEInScore: false };
}

function baseAssessment(): Assessment {
  return createEmptyAssessment('assess-1', {
    nameOrId: 'A. Test',
    date: '2026-06-08',
    stage1Result: '',
    stage1Note: '',
  });
}

describe('buildRecruiterSummary - pełny przypadek', () => {
  it('zawiera nagłówek, werdykt, profil, flagi, decyzję i negocjacje', () => {
    const a = baseAssessment();
    a.marks = { A: 4, B: 5, C: 3, D: 4 };
    a.flags = { A: { red: false, green: true }, C: { red: true, green: false } };
    a.notes = { B: 'solidnie z SQL' };
    a.decision = 'yes';
    a.decisionNote = 'oferta junior';
    a.negotiation = {
      oczekiwania: '8 PLN',
      widelki: '',
      formaUmowy: 'B2B',
      dostepnosc: '',
      uwagi: '',
    };
    a.timer.elapsedSec = 65 * 60 + 12;

    const r = buildRecruiterSummary(a, settings());

    expect(r.text).toContain('A. Test');
    expect(r.text).toContain('2026-06-08');
    expect(r.text).toContain('65:12');
    expect(r.text).toContain('Wysoki wynik względny');
    expect(r.text).toContain('Blok B (waga 30%): poziom 5/5');
    expect(r.text).toContain('Blok A (waga 15%): poziom 4/5');
    // Flagi
    expect(r.text).toMatch(/Zielona, Blok A/);
    expect(r.text).toMatch(/Czerwona, Blok C/);
    // Notatka B
    expect(r.text).toContain('solidnie z SQL');
    // Decyzja
    expect(r.text).toContain('Tak, oferta');
    expect(r.text).toContain('oferta junior');
    // Negocjacje
    expect(r.text).toContain('Oczekiwania: 8 PLN');
    expect(r.text).toContain('Forma umowy: B2B');
    // HTML
    expect(r.html).toContain('<h3>Werdykt</h3>');
    expect(r.html).toContain('<ul>');
    expect(r.html).toContain('<!-- bakk-etap2:assess-1 -->');
    expect(r.html).toMatch(/Zielona, Blok A/);
    expect(r.html).not.toContain('<script');
  });
});

describe('buildRecruiterSummary - niepełny przypadek', () => {
  it('pomija sekcje Decyzja i Negocjacje, gdy brak danych', () => {
    const a = baseAssessment();
    a.marks = { A: 2 };

    const r = buildRecruiterSummary(a, settings());

    // Werdykt powinien być zgodny z computeScore (A=2 → bardzo niski)
    expect(r.text).toMatch(/Niski wynik względny|Średni wynik względny/);
    expect(r.text).not.toContain('Decyzja:');
    expect(r.text).not.toContain('Negocjacje:');
    // Profil pokazuje "nie oceniono" dla pustych bloków
    expect(r.text).toContain('Blok B (waga 30%): nie oceniono');
  });
});

describe('buildRecruiterSummary - XSS', () => {
  it('escape\'uje notatkę z <script> w HTML', () => {
    const a = baseAssessment();
    a.notes = { B: '<script>alert(1)</script>' };

    const r = buildRecruiterSummary(a, settings());

    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).not.toContain('<script');
  });
});

describe('buildRecruiterSummary - truncation', () => {
  it('ucina notatkę dłuższą niż 240 znaków i dodaje …', () => {
    const a = baseAssessment();
    const longNote = 'a'.repeat(300);
    a.notes = { B: longNote };

    const r = buildRecruiterSummary(a, settings());

    expect(r.text).toContain('…');
    expect(r.html).toContain('…');
    // Nie zawiera pełnej długości
    expect(r.text).not.toContain('a'.repeat(300));
  });
});

describe('buildRecruiterSummary - wariant A-alt (wykres)', () => {
  it('opisuje blok A jako "Blok A (wykres)" gdy useAChart=true', () => {
    const a = baseAssessment();
    a.useAChart = true;
    a.marks = { A: 3 };

    const r = buildRecruiterSummary(a, settings());

    expect(r.text).toContain('Blok A (wykres)');
    expect(r.html).toContain('Blok A (wykres)');
  });
});

describe('buildRecruiterSummary - blok E', () => {
  it('uwzględnia blok E w profilu, gdy useE=true', () => {
    const a = baseAssessment();
    a.useE = true;
    a.marks = { A: 4, B: 4, C: 4, D: 4, E: 5 };

    const r = buildRecruiterSummary(a, settings());

    expect(r.text).toContain('Blok E');
  });

  it('pomija blok E, gdy useE=false', () => {
    const a = baseAssessment();
    a.useE = false;
    a.marks = { A: 4 };

    const r = buildRecruiterSummary(a, settings());

    expect(r.text).not.toContain('Blok E');
  });
});

describe('buildRecruiterSummary - marker idempotencji', () => {
  it('zawsze dołącza marker bakk-etap2:<id> na końcu HTML', () => {
    const a = baseAssessment();
    const r = buildRecruiterSummary(a, settings());
    expect(r.html.trim().endsWith(`<!-- bakk-etap2:${a.id} -->`)).toBe(true);
  });
});
