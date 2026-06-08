import { BLOCKS } from '../content/blocks';
import { computeScore } from '../domain/scoring';
import { DEFAULT_WEIGHTS } from '../domain/weights.config';
import type { Decision } from '../domain/model';
import { repo, session } from '../state';
import { navigate } from '../app';
import { elapsedStr } from './timer-ui';

export function renderSummary(host: HTMLElement): void {
  const a = session.current!;
  const r = computeScore(a.marks, DEFAULT_WEIGHTS);
  const verdict = r.score >= 75 ? 'Wysoki wynik względny' : r.score >= 55 ? 'Średni wynik względny' : 'Niski wynik względny';
  const incomplete = !r.complete ? `<div class="callout warn">Ocena niepełna: oceniono ${r.scoredCount}/${r.totalWeightedBlocks} bloków ważonych. Wynik liczony tylko z ocenionych.</div>` : '';

  const flagsHtml = BLOCKS.flatMap((b) => {
    const f = a.flags[b.id] ?? { red: false, green: false };
    const out: string[] = [];
    if (f.red) out.push(`<div class="fchip red">⚑ ${b.title}: ${b.flagRed}</div>`);
    if (f.green) out.push(`<div class="fchip green">⚑ ${b.title}: ${b.flagGreen}</div>`);
    return out;
  }).join('');

  host.innerHTML = `
    <div class="card"><div class="card-body">
      ${incomplete}
      <div class="scorebig"><div class="val"><b>${r.score}</b><span>na 100</span></div><div class="verdict">${verdict} · ${a.candidate.nameOrId} · ⏱ ${elapsedStr()}</div></div>
      <div class="breakdown">${BLOCKS.filter((b) => !b.optional || a.useE).map((b) => {
        const m = r.profile[b.id]; const wl = b.weight ? `waga ${b.weight}%` : 'bez wagi';
        return `<div class="brow"><div class="bn">${b.title}<small>${wl}</small></div><div class="bv">${m ? m + '/5' : '—'}</div></div>`;
      }).join('')}</div>
      <div class="flags-summary">${flagsHtml}</div>

      <div class="section-title">Decyzja prowadzącego</div>
      <div class="decide">
        <button class="dbtn yes" data-d="yes">Tak — oferta</button>
        <button class="dbtn wait" data-d="wait">Czekamy — porównać</button>
        <button class="dbtn no" data-d="no">Nie</button>
      </div>
      <textarea id="dec-note" placeholder="Uzasadnienie decyzji">${a.decisionNote}</textarea>

      <div class="section-title">Negocjacje i warunki <span class="muted">— poza oceną</span></div>
      <div class="neg-grid">
        <input id="neg-ocz" placeholder="Oczekiwania finansowe" value="${a.negotiation.oczekiwania}">
        <input id="neg-wid" placeholder="Proponowane widełki" value="${a.negotiation.widelki}">
        <input id="neg-forma" placeholder="Forma umowy" value="${a.negotiation.formaUmowy}">
        <input id="neg-dost" placeholder="Dostępność / wypowiedzenie" value="${a.negotiation.dostepnosc}">
        <input id="neg-uwagi" class="full" placeholder="Uwagi" value="${a.negotiation.uwagi}">
      </div>

      <div class="nav">
        <button class="btn ghost" id="back">← Wróć do oceny</button>
        <button class="btn primary" id="save">Zapisz i pokaż zestawienie →</button>
      </div>
    </div></div>`;

  const setDec = (d: Decision) => { a.decision = d; host.querySelectorAll('.dbtn').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.d === d)); };
  host.querySelectorAll<HTMLElement>('.dbtn').forEach((btn) => (btn.onclick = () => setDec(btn.dataset.d as Decision)));
  if (a.decision) setDec(a.decision);

  (host.querySelector('#dec-note') as HTMLTextAreaElement).oninput = (e) => { a.decisionNote = (e.target as HTMLTextAreaElement).value; };
  const bind = (id: string, key: keyof typeof a.negotiation) => {
    (host.querySelector(id) as HTMLInputElement).oninput = (e) => { a.negotiation[key] = (e.target as HTMLInputElement).value; };
  };
  bind('#neg-ocz', 'oczekiwania'); bind('#neg-wid', 'widelki'); bind('#neg-forma', 'formaUmowy'); bind('#neg-dost', 'dostepnosc'); bind('#neg-uwagi', 'uwagi');

  (host.querySelector('#back') as HTMLButtonElement).onclick = () => navigate('assess');
  (host.querySelector('#save') as HTMLButtonElement).onclick = async () => { await repo.save(a); navigate('roster'); };
}
