import { BLOCKS } from '../content/blocks';
import type { Block } from '../content/blocks';
import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import type { Assessment } from '../domain/model';
import { repo, session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';
import { downloadTextFile, safeFilenamePart } from './download';
import { serializeAssessment } from '../export/json';

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const DEC_LABEL: Record<'yes' | 'no' | 'wait', string> = {
  yes: 'Tak',
  no: 'Nie',
  wait: 'Czekamy',
};

function backCard(host: HTMLElement, message: string): void {
  host.innerHTML = `
    <div class="card"><div class="card-body">
      <p class="detail-empty">${escapeHtml(message)}</p>
      <div class="nav"><button class="btn ghost" id="back">← Wróć do zestawienia</button></div>
    </div></div>`;
  (host.querySelector('#back') as HTMLButtonElement).onclick = () => navigate('roster');
}

function renderProfile(a: Assessment, blocks: Block[]): string {
  const rows = blocks
    .map((b) => {
      const m = a.marks[b.id];
      const wl = b.weight ? `waga ${b.weight}%` : 'bez wagi';
      return `<div class="detail-prow">
        <div class="detail-pname">${escapeHtml(b.title)} <span class="muted">(${escapeHtml(b.id)})</span></div>
        <div class="detail-pweight">${wl}</div>
        <div class="detail-pmark">${m ? `${m}<small>/5</small>` : '—'}</div>
      </div>`;
    })
    .join('');
  return `<div class="detail-profile">${rows}</div>`;
}

function renderFlags(a: Assessment, blocks: Block[]): string {
  const items = blocks
    .flatMap((b) => {
      const f = a.flags[b.id];
      if (!f) return [];
      const out: string[] = [];
      if (f.red) out.push(`<div class="pcard-flag red"><b>${escapeHtml(b.title)}:</b> ${b.flagRed}</div>`);
      if (f.green) out.push(`<div class="pcard-flag green"><b>${escapeHtml(b.title)}:</b> ${b.flagGreen}</div>`);
      return out;
    })
    .join('');
  return items
    ? `<div class="section-title">Flagi</div><div class="detail-flags">${items}</div>`
    : '';
}

function renderNotes(a: Assessment, blocks: Block[]): string {
  const cards = blocks
    .map((b) => {
      const note = (a.notes[b.id] ?? '').trim();
      const askedMap = a.askedQuestions[b.id] ?? {};
      const askedIdxs = b.questions
        ? b.questions.map((_, i) => (askedMap[i] ? i + 1 : null)).filter((x): x is number => x !== null)
        : [];
      const deepen = a.deepenAsked[b.id] === true;
      if (!note && askedIdxs.length === 0 && !deepen) return '';
      const askedLine = askedIdxs.length
        ? `<div class="note-asked">Pytania zadane: ${askedIdxs.join(', ')}${b.questions ? ` (z ${b.questions.length})` : ''}</div>
           <ul class="note-asked-list">${askedIdxs.map((i) => `<li>${escapeHtml(b.questions![i - 1])}</li>`).join('')}</ul>`
        : '';
      const deepenLine = deepen ? '<div class="note-deepen">pytanie pogłębiające: zadano</div>' : '';
      const noteBody = note ? `<div class="note-body">${escapeHtml(note)}</div>` : '';
      return `<div class="note-card">
        <div class="note-head"><b>${escapeHtml(b.id)}</b> ${escapeHtml(b.title)}</div>
        ${noteBody}
        ${askedLine}
        ${deepenLine}
      </div>`;
    })
    .join('');
  return cards
    ? `<div class="section-title">Notatki z bloków</div><div class="notes-section">${cards}</div>`
    : '<div class="section-title">Notatki z bloków</div><div class="notes-empty">Brak notatek z bloków.</div>';
}

function renderNegotiation(a: Assessment): string {
  const fields: ReadonlyArray<[string, string]> = [
    ['Oczekiwania finansowe', a.negotiation.oczekiwania],
    ['Proponowane widełki', a.negotiation.widelki],
    ['Forma umowy', a.negotiation.formaUmowy],
    ['Dostępność / wypowiedzenie', a.negotiation.dostepnosc],
    ['Uwagi', a.negotiation.uwagi],
  ];
  const rows = fields
    .map(
      ([label, value]) =>
        `<div class="detail-row"><span class="label">${label}</span><span>${value.trim() ? escapeHtml(value) : '—'}</span></div>`,
    )
    .join('');
  return `<div class="section-title">Negocjacje i warunki <span class="muted">— poza oceną</span></div>
    <div class="detail-neg">${rows}</div>`;
}

function renderDecision(a: Assessment): string {
  const tag = a.decision
    ? `<span class="dec-tag ${a.decision}">${DEC_LABEL[a.decision]}</span>`
    : '<span class="dec-tag">brak decyzji</span>';
  const noteBody = a.decisionNote.trim() ? `<div class="note-body">${escapeHtml(a.decisionNote)}</div>` : '';
  return `<div class="section-title">Decyzja prowadzącego</div>
    <div class="detail-decision">${tag}${noteBody}</div>`;
}

export async function renderDetail(host: HTMLElement): Promise<void> {
  if (!session.detailId) {
    backCard(host, 'Nie wybrano kandydata.');
    return;
  }

  let a: Assessment | null;
  try {
    a = await repo.get(session.detailId);
  } catch (error: unknown) {
    console.error('Wczytanie oceny nie powiodło się', error);
    backCard(host, 'Nie udało się wczytać oceny.');
    return;
  }
  if (!a) {
    backCard(host, 'Nie znaleziono oceny.');
    return;
  }

  const blocks = BLOCKS.filter((b) => !b.optional || a!.useE);
  const score = computeScore(a.marks, DEFAULT_WEIGHTS).score;
  const stage1 = a.candidate.stage1Result.trim() ? escapeHtml(a.candidate.stage1Result) : '—';
  const stage1Note = a.candidate.stage1Note.trim() ? escapeHtml(a.candidate.stage1Note) : '—';

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="meta">Szczegóły kandydata</div>
          <h2 id="detail-name">${escapeHtml(a.candidate.nameOrId)}</h2>
        </div>
        <div class="right"><div class="pill time">⏱ ${mmss(a.timer.elapsedSec)}</div></div>
      </div>
      <div class="card-body">
        <div class="detail-neg">
          <div class="detail-row"><span class="label">Data</span><span>${escapeHtml(a.candidate.date) || '—'}</span></div>
          <div class="detail-row"><span class="label">Wynik etapu I</span><span>${stage1}</span></div>
          <div class="detail-row"><span class="label">Notatka z etapu I</span><span>${stage1Note}</span></div>
        </div>

        <div class="scorebig">
          <div class="val"><b id="detail-score">${score}</b><span>na 100</span></div>
        </div>

        <div class="section-title">Profil — wynik per blok</div>
        ${renderProfile(a, blocks)}

        ${renderFlags(a, blocks)}

        ${renderNotes(a, blocks)}

        ${renderNegotiation(a)}

        ${renderDecision(a)}

        <div id="detail-status" class="roster-status" hidden></div>

        <div class="nav">
          <button class="btn ghost" id="back">← Wróć do zestawienia</button>
          <button class="btn ghost" id="export-json">Eksport JSON</button>
          <button class="btn ghost" id="delete">Usuń</button>
          <button class="btn primary" id="edit">Edytuj</button>
        </div>
      </div>
    </div>`;

  const record = a;
  const statusEl = host.querySelector('#detail-status') as HTMLDivElement;

  (host.querySelector('#back') as HTMLButtonElement).onclick = () => navigate('roster');

  (host.querySelector('#edit') as HTMLButtonElement).onclick = () => {
    session.current = record;
    session.cur = 0;
    session.visited = new Set();
    navigate('assess');
  };

  (host.querySelector('#export-json') as HTMLButtonElement).onclick = () => {
    downloadTextFile(
      `ocena_${safeFilenamePart(record.candidate.nameOrId)}.json`,
      'application/json;charset=utf-8',
      serializeAssessment(record),
    );
  };

  (host.querySelector('#delete') as HTMLButtonElement).onclick = async () => {
    if (
      !confirm(
        `Czy na pewno usunąć ocenę kandydata "${record.candidate.nameOrId}"? Tej operacji nie można cofnąć.`,
      )
    ) {
      return;
    }
    try {
      await repo.delete(record.id);
      navigate('roster');
    } catch (error: unknown) {
      console.error('Usuwanie oceny nie powiodło się', error);
      const message = error instanceof Error ? error.message : 'nieznany błąd.';
      statusEl.textContent = `Błąd usuwania: ${message}`;
      statusEl.className = 'roster-status error';
      statusEl.hidden = false;
    }
  };
}
