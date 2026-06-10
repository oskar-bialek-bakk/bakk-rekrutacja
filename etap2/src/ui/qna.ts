import type { InterviewQuestion } from '../content/interview-questions';
import type { Assessment } from '../domain/model';
import { escapeHtml } from './escape';

// Wspólne renderowanie pytań wstępnych/zamykających: jeden wzorzec karty
// (pytanie + składana podpowiedź + sygnały do odznaczenia + notatka + opcjonalna
// flaga) używany na ekranie intro, w podsumowaniu i (read-only) w szczegółach.

export type QnaKind = 'intro' | 'closing';

function notesMap(a: Assessment, kind: QnaKind): Record<string, string> {
  return kind === 'intro' ? a.intro : a.closing;
}

function signalsHtml(q: InterviewQuestion, checks: Record<string, boolean>): string {
  if (!q.signals?.length) return '';
  const items = q.signals
    .map(
      (s) => `
        <label class="qsignal ${s.tone} ${checks[s.id] ? 'on' : ''}" data-sig="${escapeHtml(s.id)}">
          <input type="checkbox" ${checks[s.id] ? 'checked' : ''}>
          <span>${escapeHtml(s.text)}</span>
        </label>`,
    )
    .join('');
  return `<div class="qna-signals"><div class="qna-signals-head">Sygnały — zaznacz zaobserwowane</div>${items}</div>`;
}

/** Edytowalna karta jednego pytania (ekran intro + podsumowanie). */
function editableItemHtml(q: InterviewQuestion, checks: Record<string, boolean>, flag: { red: boolean; green: boolean }): string {
  const hint = q.hint
    ? `<details class="qna-hint-box"><summary>Na co zwrócić uwagę</summary><div>${escapeHtml(q.hint)}</div></details>`
    : '';
  const flagRow = q.flag
    ? `<div class="flagrow qna-flagrow" data-q="${escapeHtml(q.id)}">
         <button type="button" class="flagbtn red ${flag.red ? 'on' : ''}" data-flag="red">⚑ Czerwona</button>
         <button type="button" class="flagbtn green ${flag.green ? 'on' : ''}" data-flag="green">⚑ Zielona</button>
       </div>`
    : '';
  return `<div class="qna-item" data-q="${escapeHtml(q.id)}">
    <div class="qna-q">${escapeHtml(q.question)}</div>
    ${hint}
    ${signalsHtml(q, checks)}
    <textarea class="qna-input" data-q="${escapeHtml(q.id)}" placeholder="Notatka z odpowiedzi…"></textarea>
    ${flagRow}
  </div>`;
}

export function qnaEditableListHtml(questions: InterviewQuestion[], a: Assessment, kind: QnaKind): string {
  return `<div class="qna-list ${kind}">${questions
    .map((q) => editableItemHtml(q, a.signalChecks[q.id] ?? {}, a.closingFlags[q.id] ?? { red: false, green: false }))
    .join('')}</div>`;
}

/**
 * Podpina edytowalne karty z `scope` do mapy ocen `a` (notatki, sygnały, flagi).
 * `scope` to element zawierający `.qna-list.${kind}`.
 */
export function bindQnaEditable(scope: ParentNode, a: Assessment, kind: QnaKind): void {
  const notes = notesMap(a, kind);

  scope.querySelectorAll<HTMLTextAreaElement>(`.qna-list.${kind} .qna-input`).forEach((ta) => {
    const id = ta.dataset.q!;
    ta.value = notes[id] ?? '';
    ta.oninput = () => { notes[id] = ta.value; };
  });

  scope.querySelectorAll<HTMLLabelElement>(`.qna-list.${kind} .qsignal`).forEach((lbl) => {
    const qid = (lbl.closest('.qna-item') as HTMLElement).dataset.q!;
    const sid = lbl.dataset.sig!;
    const cb = lbl.querySelector('input[type=checkbox]') as HTMLInputElement;
    cb.onchange = () => {
      // Trzymamy tylko zaznaczone (true). Odznaczenie usuwa wpis, a pusta mapa
      // pytania znika — spójnie z migracją/testem i bez rozdymania zapisu.
      const cur = { ...(a.signalChecks[qid] ?? {}) };
      if (cb.checked) cur[sid] = true;
      else delete cur[sid];
      if (Object.keys(cur).length > 0) a.signalChecks[qid] = cur;
      else delete a.signalChecks[qid];
      lbl.classList.toggle('on', cb.checked);
    };
  });

  scope.querySelectorAll<HTMLElement>(`.qna-list.${kind} .qna-flagrow`).forEach((row) => {
    const id = row.dataset.q!;
    const redBtn = row.querySelector('[data-flag="red"]') as HTMLButtonElement;
    const greenBtn = row.querySelector('[data-flag="green"]') as HTMLButtonElement;
    redBtn.onclick = () => {
      const c = a.closingFlags[id] ?? { red: false, green: false };
      const next = { red: !c.red, green: c.green };
      a.closingFlags[id] = next;
      redBtn.classList.toggle('on', next.red);
    };
    greenBtn.onclick = () => {
      const c = a.closingFlags[id] ?? { red: false, green: false };
      const next = { red: c.red, green: !c.green };
      a.closingFlags[id] = next;
      greenBtn.classList.toggle('on', next.green);
    };
  });
}

/** Czy w danym zestawie pytań jest cokolwiek wypełnione (notatka / sygnał / flaga). */
export function hasQnaContent(questions: InterviewQuestion[], a: Assessment, kind: QnaKind): boolean {
  const notes = notesMap(a, kind);
  return questions.some((q) => {
    if ((notes[q.id] ?? '').trim()) return true;
    const checks = a.signalChecks[q.id] ?? {};
    if (Object.values(checks).some(Boolean)) return true;
    const f = a.closingFlags[q.id];
    return !!(f && (f.red || f.green));
  });
}

/** Read-only podsumowanie wypełnionych pytań (ekran szczegółów). Zwraca '' gdy pusto. */
export function qnaSummaryHtml(questions: InterviewQuestion[], a: Assessment, kind: QnaKind): string {
  const notes = notesMap(a, kind);
  const cards = questions
    .map((q) => {
      const note = (notes[q.id] ?? '').trim();
      const checks = a.signalChecks[q.id] ?? {};
      const checked = (q.signals ?? []).filter((s) => checks[s.id]);
      const f = a.closingFlags[q.id];
      const flagOn = !!(f && (f.red || f.green));
      if (!note && checked.length === 0 && !flagOn) return '';
      const flagTag = f?.red
        ? '<span class="qna-flagtag red">⚑ czerwona</span>'
        : f?.green
          ? '<span class="qna-flagtag green">⚑ zielona</span>'
          : '';
      const signalChips = checked.length
        ? `<div class="qna-sum-signals">${checked
            .map((s) => `<span class="qna-chip ${s.tone}">${escapeHtml(s.text)}</span>`)
            .join('')}</div>`
        : '';
      const noteBody = note ? `<div class="note-body">${escapeHtml(note)}</div>` : '';
      return `<div class="note-card">
        <div class="note-head">${escapeHtml(q.short)} ${flagTag}</div>
        ${signalChips}
        ${noteBody}
      </div>`;
    })
    .filter(Boolean)
    .join('');
  return cards;
}
