import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import { repo, session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';
import { stopTimer } from './timer-ui';

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
      <button class="btn ghost" id="new">+ Nowa rozmowa</button></div>
      <div class="card-body"><table>
        <thead><tr><th>Kandydat</th><th>Data</th><th>Etap I</th><th>Etap II</th><th>Flagi</th><th>Decyzja</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="name">${escapeHtml(r.a.candidate.nameOrId)}</td><td>${escapeHtml(r.a.candidate.date)}</td>
          <td>${escapeHtml(r.a.candidate.stage1Result) || '—'}</td><td><span class="score-tag">${r.score}</span> / 100</td>
          <td>${'🔴'.repeat(r.red)}${'🟢'.repeat(r.green) || (r.red ? '' : '—')}</td><td>${decTag(r.a.decision)}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;

  (host.querySelector('#new') as HTMLButtonElement).onclick = () => {
    stopTimer();
    session.current = null;
    session.cur = 0;
    navigate('start');
  };
}
