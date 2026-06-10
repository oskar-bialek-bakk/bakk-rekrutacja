import type { Assessment, Settings, BlockId } from './model';
import { computeScore } from './scoring';
import { BLOCKS } from '../content/blocks';
import { INTRO_QUESTIONS, CLOSING_QUESTIONS } from '../content/interview-questions';
import { escapeHtml } from './escape';

export interface RecruiterSummary {
  text: string;
  html: string;
}

const NOTE_MAX = 240;
const BLOCK_ORDER: BlockId[] = ['A', 'B', 'C', 'D', 'E'];

const NEGOTIATION_LABELS: Array<{ key: keyof Assessment['negotiation']; label: string }> = [
  { key: 'oczekiwania', label: 'Oczekiwania' },
  { key: 'widelki', label: 'Widełki' },
  { key: 'formaUmowy', label: 'Forma umowy' },
  { key: 'dostepnosc', label: 'Dostępność' },
  { key: 'uwagi', label: 'Uwagi' },
];

function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function verdictLabel(score: number): string {
  if (score >= 75) return 'Wysoki wynik względny';
  if (score >= 55) return 'Średni wynik względny';
  return 'Niski wynik względny';
}

function decisionLabel(d: Assessment['decision']): string | null {
  if (d === 'yes') return 'Tak, oferta';
  if (d === 'wait') return 'Czekamy';
  if (d === 'no') return 'Nie';
  return null;
}

function truncate(s: string): string {
  if (s.length <= NOTE_MAX) return s;
  return s.slice(0, NOTE_MAX) + '…';
}

function blockTitle(id: BlockId, a: Assessment): string {
  if (id === 'A' && a.useAChart) return 'Blok A (wykres)';
  const b = BLOCKS.find((x) => x.id === id);
  return b ? `Blok ${id}` : `Blok ${id}`;
}

function activeBlocks(a: Assessment): BlockId[] {
  return BLOCK_ORDER.filter((id) => {
    if (id === 'E') return a.useE;
    return true;
  });
}

function block(id: BlockId): typeof BLOCKS[number] | undefined {
  return BLOCKS.find((b) => b.id === id);
}

interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

function buildSections(a: Assessment, settings: Settings): Section[] {
  const sections: Section[] = [];

  // 1. Header
  const headerLines: string[] = [];
  const name = a.candidate.nameOrId.trim() || a.id;
  headerLines.push(`Kandydat: ${name}`);
  const recName = a.candidate.recruitmentName?.trim();
  if (recName) headerLines.push(`Rekrutacja: ${recName}`);
  if (a.candidate.date.trim()) headerLines.push(`Data rozmowy: ${a.candidate.date}`);
  headerLines.push(`Czas trwania: ${formatElapsed(a.timer.elapsedSec)}`);
  sections.push({ heading: 'Podsumowanie rekrutera', paragraphs: headerLines });

  // 2. Verdict + score
  const score = computeScore(a.marks, settings.weights, { includeE: settings.includeEInScore });
  sections.push({
    heading: 'Werdykt',
    paragraphs: [`Wynik: ${score.score}/100`, verdictLabel(score.score)],
  });

  // 2b. Pytania wstępne (wywiad otwierający) — notatka + odznaczone sygnały
  const introBullets: string[] = [];
  for (const q of INTRO_QUESTIONS) {
    const ans = (a.intro[q.id] ?? '').trim();
    const checks = a.signalChecks[q.id] ?? {};
    const checked = (q.signals ?? []).filter((s) => checks[s.id]);
    if (!ans && checked.length === 0) continue;
    const sigPart = checked.length ? ` [${checked.map((s) => s.text).join('; ')}]` : '';
    introBullets.push(`${q.short}: ${ans ? truncate(ans) : '(bez notatki)'}${sigPart}`);
  }
  if (introBullets.length > 0) {
    sections.push({ heading: 'Wywiad otwierający', bullets: introBullets });
  }

  // 3. Profile per block
  const profileBullets: string[] = [];
  for (const id of activeBlocks(a)) {
    const w = settings.weights[id];
    const title = blockTitle(id, a);
    const m = a.marks[id];
    const mark = m == null ? 'nie oceniono' : `poziom ${m}/5`;
    profileBullets.push(`${title} (waga ${w}%): ${mark}`);
  }
  sections.push({ heading: 'Profil per blok', bullets: profileBullets });

  // 4. Flags
  const flagBullets: string[] = [];
  for (const id of activeBlocks(a)) {
    const f = a.flags[id];
    if (!f) continue;
    const b = block(id);
    if (!b) continue;
    const title = blockTitle(id, a);
    if (f.red) flagBullets.push(`Czerwona, ${title}: ${b.flagRed}`);
    if (f.green) flagBullets.push(`Zielona, ${title}: ${b.flagGreen}`);
  }
  if (flagBullets.length > 0) {
    sections.push({ heading: 'Flagi', bullets: flagBullets });
  }

  // 5. Notes
  const noteBullets: string[] = [];
  for (const id of activeBlocks(a)) {
    const raw = (a.notes[id] ?? '').trim();
    if (!raw) continue;
    const title = blockTitle(id, a);
    noteBullets.push(`${title}: ${truncate(raw)}`);
  }
  if (noteBullets.length > 0) {
    sections.push({ heading: 'Notatki', bullets: noteBullets });
  }

  // 6. Decision
  const dLabel = decisionLabel(a.decision);
  if (dLabel) {
    const paras = [`Decyzja: ${dLabel}`];
    const note = a.decisionNote.trim();
    if (note) paras.push(`Komentarz: ${note}`);
    sections.push({ heading: 'Decyzja', paragraphs: paras });
  }

  // 6b. Pytania zamykające — notatka + odznaczone sygnały + flaga „narzekanie"
  const closingBullets: string[] = [];
  for (const q of CLOSING_QUESTIONS) {
    const ans = (a.closing[q.id] ?? '').trim();
    const checks = a.signalChecks[q.id] ?? {};
    const checked = (q.signals ?? []).filter((s) => checks[s.id]);
    const f = a.closingFlags[q.id];
    const flagTag = f?.red ? ' [czerwona flaga]' : f?.green ? ' [zielona flaga]' : '';
    if (!ans && checked.length === 0 && !flagTag) continue;
    const sigPart = checked.length ? ` [${checked.map((s) => s.text).join('; ')}]` : '';
    closingBullets.push(`${q.short}: ${ans ? truncate(ans) : '(bez notatki)'}${sigPart}${flagTag}`);
  }
  if (closingBullets.length > 0) {
    sections.push({ heading: 'Pytania zamykające', bullets: closingBullets });
  }

  // 7. Negotiation
  const negBullets: string[] = [];
  for (const { key, label } of NEGOTIATION_LABELS) {
    const v = a.negotiation[key].trim();
    if (!v) continue;
    negBullets.push(`${label}: ${v}`);
  }
  if (negBullets.length > 0) {
    sections.push({ heading: 'Negocjacje', bullets: negBullets });
  }

  // 8. Stage I
  const stage1Paras: string[] = [];
  const s1r = a.candidate.stage1Result.trim();
  const s1n = a.candidate.stage1Note.trim();
  if (s1r) stage1Paras.push(`Wynik etapu I: ${s1r}`);
  if (s1n) stage1Paras.push(`Notatka etapu I: ${s1n}`);
  if (stage1Paras.length > 0) {
    sections.push({ heading: 'Etap I', paragraphs: stage1Paras });
  }

  return sections;
}

function renderText(sections: Section[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    const lines: string[] = [];
    lines.push(`${s.heading}:`);
    if (s.paragraphs) {
      for (const p of s.paragraphs) lines.push(p);
    }
    if (s.bullets) {
      for (const b of s.bullets) lines.push(`- ${b}`);
    }
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n') + '\n';
}

function renderHtml(sections: Section[], id: string): string {
  const parts: string[] = [];
  parts.push('<h2>🤖 BAKK Etap II rekrutacji</h2>');
  for (const s of sections) {
    parts.push(`<h3>${escapeHtml(s.heading)}</h3>`);
    if (s.paragraphs) {
      for (const p of s.paragraphs) parts.push(`<p>${escapeHtml(p)}</p>`);
    }
    if (s.bullets && s.bullets.length > 0) {
      const items = s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
      parts.push(`<ul>${items}</ul>`);
    }
  }
  parts.push(`<!-- bakk-etap2:${id} -->`);
  return parts.join('');
}

export function buildRecruiterSummary(a: Assessment, settings: Settings): RecruiterSummary {
  const sections = buildSections(a, settings);
  return {
    text: renderText(sections),
    html: renderHtml(sections, a.id),
  };
}
