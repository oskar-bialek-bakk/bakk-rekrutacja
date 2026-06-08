import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import { repo, session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';
import { stopTimer } from './timer-ui';
import { downloadTextFile } from './download';
import { rosterToCsv, type RosterRow } from '../export/csv';
import { serializeAll, parseImport } from '../export/json';

export async function renderRoster(host: HTMLElement): Promise<void> {
  const all = await repo.findAll();
  const rows = all.map((a) => {
    const score = computeScore(a.marks, DEFAULT_WEIGHTS).score;
    const red = Object.values(a.flags).filter((f) => f?.red).length;
    const green = Object.values(a.flags).filter((f) => f?.green).length;
    return { a, score, red, green };
  }).sort((x, y) => y.score - x.score);

  const decTag = (d: string | null) =>
    d === 'yes' ? '<span class="dec-tag yes">Tak</span>' : d === 'wait' ? '<span class="dec-tag wait">Czekamy</span>' : d === 'no' ? '<span class="dec-tag no">Nie</span>' : '—';

  host.innerHTML = `
    <div class="card"><div class="card-head"><h2>Porównanie kandydatów</h2>
      <div class="toolbar">
        <button class="btn ghost" id="export-csv">Eksport CSV</button>
        <button class="btn ghost" id="export-json">Eksport JSON</button>
        <button class="btn ghost" id="import-json">Import JSON</button>
        <button class="btn ghost" id="new">+ Nowa rozmowa</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div></div>
      <div id="roster-status" class="roster-status" hidden></div>
      <div class="card-body"><table>
        <thead><tr><th>Kandydat</th><th>Data</th><th>Etap I</th><th>Etap II</th><th>Flagi</th><th>Decyzja</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="name">${escapeHtml(r.a.candidate.nameOrId)}</td><td>${escapeHtml(r.a.candidate.date)}</td>
          <td>${escapeHtml(r.a.candidate.stage1Result) || '—'}</td><td><span class="score-tag">${r.score}</span> / 100</td>
          <td>${'🔴'.repeat(r.red)}${'🟢'.repeat(r.green) || (r.red ? '' : '—')}</td><td>${decTag(r.a.decision)}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;

  const statusEl = host.querySelector('#roster-status') as HTMLDivElement;
  const showStatus = (message: string, kind: 'ok' | 'error') => {
    statusEl.textContent = message;
    statusEl.className = `roster-status ${kind}`;
    statusEl.hidden = false;
  };

  (host.querySelector('#new') as HTMLButtonElement).onclick = () => {
    stopTimer();
    session.current = null;
    session.cur = 0;
    navigate('start');
  };

  (host.querySelector('#export-csv') as HTMLButtonElement).onclick = () => {
    const csvRows: RosterRow[] = rows.map((r) => ({
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
