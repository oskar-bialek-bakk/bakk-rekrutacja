import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import {
  sortRows,
  filterByDecision,
  type SortKey,
  type SortDir,
  type DecisionFilter,
} from '../domain/roster';
import { repo, session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';
import { stopTimer } from './timer-ui';
import { downloadTextFile } from './download';
import { rosterToCsv, type RosterRow } from '../export/csv';
import { serializeAll, parseImport } from '../export/json';

// Module-level UI state survives re-renders after delete/import.
let sortKey: SortKey = 'score';
let sortDir: SortDir = 'desc';
let filterDecision: DecisionFilter = 'all';

export async function renderRoster(host: HTMLElement): Promise<void> {
  const all = await repo.findAll();
  const rows = all.map((a) => {
    const score = computeScore(a.marks, DEFAULT_WEIGHTS).score;
    const red = Object.values(a.flags).filter((f) => f?.red).length;
    const green = Object.values(a.flags).filter((f) => f?.green).length;
    return {
      a,
      score,
      red,
      green,
      nameOrId: a.candidate.nameOrId,
      date: a.candidate.date,
      decision: a.decision,
    };
  });
  // Apply current filter then sort; defaults keep the initial view at score desc.
  const processed = sortRows(filterByDecision(rows, filterDecision), sortKey, sortDir);

  const decTag = (d: string | null) =>
    d === 'yes' ? '<span class="dec-tag yes">Tak</span>' : d === 'wait' ? '<span class="dec-tag wait">Czekamy</span>' : d === 'no' ? '<span class="dec-tag no">Nie</span>' : '—';

  const sortKeyOptions: ReadonlyArray<[SortKey, string]> = [
    ['score', 'Wynik II'],
    ['date', 'Data'],
    ['name', 'Kandydat'],
  ];
  const filterOptions: ReadonlyArray<[DecisionFilter, string]> = [
    ['all', 'Wszystkie'],
    ['yes', 'Tak'],
    ['wait', 'Czekamy'],
    ['no', 'Nie'],
  ];
  const option = <T extends string>(value: T, label: string, selected: T) =>
    `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;

  // Pusty stan: gdy lista po filtrze i sortowaniu jest pusta, pokaż jeden wiersz
  // na pełną szerokość tabeli zamiast pustego tbody.
  const emptyMessage =
    all.length === 0
      ? 'Brak ocen. Rozpocznij nową rozmowę, aby dodać kandydata.'
      : 'Brak wyników dla wybranego filtra.';
  const tbodyRows =
    processed.length === 0
      ? `<tr><td class="roster-empty" colspan="7">${emptyMessage}</td></tr>`
      : processed
          .map(
            (r) => `<tr>
          <td class="name">${escapeHtml(r.a.candidate.nameOrId)}</td><td>${escapeHtml(r.a.candidate.date)}</td>
          <td>${escapeHtml(r.a.candidate.stage1Result) || '—'}</td><td><span class="score-tag">${r.score}</span> / 100</td>
          <td>${'🔴'.repeat(r.red)}${'🟢'.repeat(r.green) || (r.red ? '' : '—')}</td><td>${decTag(r.a.decision)}</td>
          <td><button class="row-del" data-id="${escapeHtml(r.a.id)}" title="Usuń">🗑</button></td>
        </tr>`
          )
          .join('');

  host.innerHTML = `
    <div class="card"><div class="card-head"><h2>Porównanie kandydatów</h2>
      <div class="toolbar">
        <button class="btn ghost" id="export-csv">Eksport CSV</button>
        <button class="btn ghost" id="export-json">Eksport JSON</button>
        <button class="btn ghost" id="import-json">Import JSON</button>
        <button class="btn ghost" id="new">+ Nowa rozmowa</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div></div>
      <div class="roster-controls">
        <label for="sort-key">Sortuj</label>
        <select id="sort-key">${sortKeyOptions.map(([v, l]) => option(v, l, sortKey)).join('')}</select>
        <button class="btn ghost" id="sort-dir" title="${sortDir === 'desc' ? 'Malejąco' : 'Rosnąco'}">${sortDir === 'desc' ? '↓' : '↑'}</button>
        <label for="filter-decision">Decyzja</label>
        <select id="filter-decision">${filterOptions.map(([v, l]) => option(v, l, filterDecision)).join('')}</select>
      </div>
      <div id="roster-status" class="roster-status" hidden></div>
      <div class="card-body"><table>
        <thead><tr><th>Kandydat</th><th>Data</th><th>Etap I</th><th>Etap II</th><th>Flagi</th><th>Decyzja</th><th></th></tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table></div></div>`;

  const statusEl = host.querySelector('#roster-status') as HTMLDivElement;
  const showStatus = (message: string, kind: 'ok' | 'error') => {
    statusEl.textContent = message;
    statusEl.className = `roster-status ${kind}`;
    statusEl.hidden = false;
  };

  (host.querySelector('#sort-key') as HTMLSelectElement).onchange = (event) => {
    sortKey = (event.target as HTMLSelectElement).value as SortKey;
    void renderRoster(host);
  };

  (host.querySelector('#sort-dir') as HTMLButtonElement).onclick = () => {
    sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    void renderRoster(host);
  };

  (host.querySelector('#filter-decision') as HTMLSelectElement).onchange = (event) => {
    filterDecision = (event.target as HTMLSelectElement).value as DecisionFilter;
    void renderRoster(host);
  };

  host.querySelectorAll<HTMLButtonElement>('.row-del').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.id;
      if (!id) return;
      const target = processed.find((r) => r.a.id === id);
      const name = target ? target.a.candidate.nameOrId : 'kandydata';
      if (!confirm(`Czy na pewno usunąć ocenę kandydata "${name}"? Tej operacji nie można cofnąć.`)) return;
      try {
        await repo.delete(id);
        await renderRoster(host);
      } catch (error: unknown) {
        console.error('Usuwanie oceny nie powiodło się', error);
        const message = error instanceof Error ? error.message : 'nieznany błąd.';
        showStatus(`Błąd usuwania: ${message}`, 'error');
      }
    };
  });

  (host.querySelector('#new') as HTMLButtonElement).onclick = () => {
    stopTimer();
    session.current = null;
    session.cur = 0;
    navigate('start');
  };

  (host.querySelector('#export-csv') as HTMLButtonElement).onclick = () => {
    // CSV eksportuje aktualnie przefiltrowany i posortowany widok (WYSIWYG).
    const csvRows: RosterRow[] = processed.map((r) => ({
      nameOrId: r.a.candidate.nameOrId,
      date: r.a.candidate.date,
      stage1Result: r.a.candidate.stage1Result,
      score: r.score,
      red: r.red,
      green: r.green,
      decision: r.a.decision ?? '',
    }));
    downloadTextFile('kandydaci_etap2.csv', 'text/csv;charset=utf-8', rosterToCsv(csvRows));
  };

  (host.querySelector('#export-json') as HTMLButtonElement).onclick = () => {
    // JSON eksportuje pełne repozytorium (kopia zapasowa wszystkich ocen).
    downloadTextFile('kandydaci_etap2.json', 'application/json;charset=utf-8', serializeAll(all));
  };

  const fileInput = host.querySelector('#import-file') as HTMLInputElement;
  (host.querySelector('#import-json') as HTMLButtonElement).onclick = () => {
    fileInput.click();
  };

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseImport(text);
      for (const assessment of imported) {
        await repo.save(assessment);
      }
      await renderRoster(host);
      const refreshedStatus = host.querySelector('#roster-status') as HTMLDivElement | null;
      if (refreshedStatus) {
        refreshedStatus.textContent = `Zaimportowano ${imported.length} ocen.`;
        refreshedStatus.className = 'roster-status ok';
        refreshedStatus.hidden = false;
      }
    } catch (error: unknown) {
      console.error('Import JSON nie powiódł się', error);
      const message = error instanceof Error ? error.message : 'nieznany błąd.';
      showStatus(`Błąd importu: ${message}`, 'error');
    }
  };
}
