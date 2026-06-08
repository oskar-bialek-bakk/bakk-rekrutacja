import { BLOCKS } from '../content/blocks';
import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import type { Decision } from '../domain/model';
import { repo, session } from '../state';
import { navigate } from '../app';
import { elapsedStr, stopTimer } from './timer-ui';
import { escapeHtml } from './escape';

export function renderSummary(host: HTMLElement): void {
  const a = session.current!;
  const r = computeScore(a.marks, DEFAULT_WEIGHTS);
  const verdict = r.score >= 75 ? 'Wysoki wynik względny' : r.score >= 55 ? 'Średni wynik względny' : 'Niski wynik względny';
  const incomplete = !r.complete
    ? `<div class="callout warn">Ocena niepełna: oceniono ${r.scoredCount}/${r.totalWeightedBlocks} bloków ważonych. Wynik liczony tylko z ocenionych.</div>`
    : '';

  const profileBlocks = BLOCKS.filter((b) => !b.optional || a.useE);
  const profileHtml = profileBlocks.map((b) => {
    const m = a.marks[b.id];
    const f = a.flags[b.id] ?? { red: false, green: false };
    const wl = b.weight ? `waga ${b.weight}%` : 'bez wagi';
    const flagsHtml = [
      f.red ? `<div class="pcard-flag red">${escapeHtml(b.flagRed)}</div>` : '',
      f.green ? `<div class="pcard-flag green">${escapeHtml(b.flagGreen)}</div>` : '',
    ].filter(Boolean).join('');
    return `
      <div class="pcard ${m ? 'scored' : 'no-mark'}">
        <div class="pcard-head">
          <div>
            <div class="pcard-title">${escapeHtml(b.title)}</div>
            <div class="pcard-weight">${wl}</div>
          </div>
          <div class="pcard-mark">${m ? `${m}<small>/5</small>` : '<small>—</small>'}</div>
        </div>
        ${flagsHtml ? `<div class="pcard-flags">${flagsHtml}</div>` : ''}
      </div>`;
  }).join('');

  const anyNotes = profileBlocks.some((b) => (a.notes[b.id] ?? '').trim() || (a.askedQuestions[b.id] && Object.values(a.askedQuestions[b.id]!).some(Boolean)));
  const notesHtml = profileBlocks.map((b) => {
    const note = (a.notes[b.id] ?? '').trim();
    const askedMap = a.askedQuestions[b.id] ?? {};
    const askedIdxs = b.questions
      ? b.questions
          .map((_, i) => (askedMap[i] ? i + 1 : null))
          .filter((x): x is number => x !== null)
      : [];
    if (!note && askedIdxs.length === 0) return '';
    const askedLine = askedIdxs.length
      ? `<div class="note-asked">Pytania zadane: ${askedIdxs.join(', ')}${b.questions ? ` (z ${b.questions.length})` : ''}</div>`
      : '';
    const noteBody = note ? `<div class="note-body">${escapeHtml(note)}</div>` : '';
    return `
      <div class="note-card">
        <div class="note-head"><b>${escapeHtml(b.id)}</b> ${escapeHtml(b.title)}</div>
        ${noteBody}
        ${askedLine}
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="meta">Podsumowanie · ${escapeHtml(a.candidate.nameOrId)}</div>
          <h2>Wynik i decyzja</h2>
        </div>
        <div class="right">
          <div class="pill time">⏱ ${elapsedStr()}</div>
        </div>
      </div>
      <div class="card-body">
        ${incomplete}
        <div class="scorebig">
          <div class="val"><b>${r.score}</b><span>na 100</span></div>
          <div class="verdict">${verdict}</div>
        </div>

        <div class="label">Profil — wynik per blok</div>
        <div class="profile-grid">${profileHtml}</div>

        <div class="section-title">Notatki z bloków</div>
        ${anyNotes ? `<div class="notes-section">${notesHtml}</div>` : '<div class="notes-empty">Brak notatek z bloków.</div>'}

        <div class="section-title">Decyzja prowadzącego</div>
        <div class="decide">
          <button class="dbtn yes" data-d="yes">Tak — oferta</button>
          <button class="dbtn wait" data-d="wait">Czekamy — porównać</button>
          <button class="dbtn no" data-d="no">Nie</button>
        </div>
        <textarea id="dec-note" placeholder="Uzasadnienie decyzji"></textarea>

        <div class="section-title">Negocjacje i warunki <span class="muted">— poza oceną</span></div>
        <div class="neg-grid">
          <div class="field"><label>Oczekiwania finansowe</label><input id="neg-ocz" placeholder="np. 9 000 zł netto"></div>
          <div class="field"><label>Proponowane widełki</label><input id="neg-wid" placeholder="np. 8–10 k netto"></div>
          <div class="field"><label>Forma umowy</label><input id="neg-forma" placeholder="UoP / B2B / zlecenie"></div>
          <div class="field"><label>Dostępność / wypowiedzenie</label><input id="neg-dost" placeholder="np. 1 miesiąc"></div>
          <div class="field full"><label>Uwagi</label><input id="neg-uwagi" placeholder="dodatkowe ustalenia"></div>
        </div>

        <div class="nav">
          <button class="btn ghost" id="back">← Wróć do oceny</button>
          <button class="btn primary" id="save">Zapisz i pokaż zestawienie →</button>
        </div>
      </div>
    </div>`;

  (host.querySelector('#dec-note') as HTMLTextAreaElement).value = a.decisionNote;
  const setInputValue = (id: string, value: string) => {
    (host.querySelector(id) as HTMLInputElement).value = value;
  };
  setInputValue('#neg-ocz', a.negotiation.oczekiwania);
  setInputValue('#neg-wid', a.negotiation.widelki);
  setInputValue('#neg-forma', a.negotiation.formaUmowy);
  setInputValue('#neg-dost', a.negotiation.dostepnosc);
  setInputValue('#neg-uwagi', a.negotiation.uwagi);

  const setDec = (d: Decision) => { a.decision = d; host.querySelectorAll('.dbtn').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.d === d)); };
  host.querySelectorAll<HTMLElement>('.dbtn').forEach((btn) => (btn.onclick = () => setDec(btn.dataset.d as Decision)));
  if (a.decision) setDec(a.decision);

  (host.querySelector('#dec-note') as HTMLTextAreaElement).oninput = (e) => { a.decisionNote = (e.target as HTMLTextAreaElement).value; };
  const bind = (id: string, key: keyof typeof a.negotiation) => {
    (host.querySelector(id) as HTMLInputElement).oninput = (e) => { a.negotiation[key] = (e.target as HTMLInputElement).value; };
  };
  bind('#neg-ocz', 'oczekiwania'); bind('#neg-wid', 'widelki'); bind('#neg-forma', 'formaUmowy'); bind('#neg-dost', 'dostepnosc'); bind('#neg-uwagi', 'uwagi');

  (host.querySelector('#back') as HTMLButtonElement).onclick = () => navigate('assess');
  (host.querySelector('#save') as HTMLButtonElement).onclick = async () => {
    stopTimer();
    await repo.save(a);
    navigate('roster');
  };
}
