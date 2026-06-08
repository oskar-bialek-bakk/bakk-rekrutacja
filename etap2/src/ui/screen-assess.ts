import { BLOCKS } from '../content/blocks';
import type { Block } from '../content/blocks';
import type { Mark } from '../domain/model';
import { session } from '../state';
import { navigate } from '../app';

function activeBlocks(): Block[] {
  return BLOCKS.filter((b) => !b.optional || session.current!.useE);
}

export function renderAssess(host: HTMLElement): void {
  const a = session.current!;
  const blocks = activeBlocks();
  if (session.cur >= blocks.length) session.cur = blocks.length - 1;
  const b = blocks[session.cur];
  const vIdx = a.selectedVariants[b.id] ?? 0;
  const sel = a.marks[b.id];
  const fl = a.flags[b.id] ?? { red: false, green: false };

  host.innerHTML = `
    <div class="stepper">${blocks.map((x, i) => {
      const state = a.marks[x.id] != null ? 'done' : i === session.cur ? 'active' : 'todo';
      return `<button class="step ${state}" data-i="${i}"><div class="k">${x.key}</div><div class="t">${x.title}</div></button>`;
    }).join('')}</div>
    <div class="card"><div class="card-body">
      <div class="twocol">
        <div>
          <div class="label">Przeczytaj kandydatowi</div>
          <div class="readbox">${b.variants[vIdx].read}</div>
          <div class="label">Ocena — wybierz poziom</div>
          <fieldset class="scale" id="scale">${b.scale.map((d, i) =>
            `<label class="lvl ${sel === i + 1 ? 'sel' : ''}"><input type="radio" name="mark" value="${i + 1}" ${sel === i + 1 ? 'checked' : ''}><span class="num">${i + 1}</span><span class="desc">${d}</span></label>`).join('')}</fieldset>
          <div class="deepen"><div class="dh">Pytanie pogłębiające <span class="tag">jeśli zostanie czas</span></div>
            <div class="dq">„${b.deepen}”</div>
            <label><input type="checkbox" id="deepen-asked" ${a.deepenAsked[b.id] ? 'checked' : ''}> zadano</label></div>
        </div>
        <div>
          <div class="keybox"><h4>${b.keyTitle}</h4><ul>${b.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
            <div class="flag red">${b.flagRed}</div><div class="flag green">${b.flagGreen}</div></div>
          <div class="flagrow">
            <button class="flagbtn red ${fl.red ? 'on' : ''}" id="fr">⚑ Czerwona</button>
            <button class="flagbtn green ${fl.green ? 'on' : ''}" id="fg">⚑ Zielona</button></div>
          <div class="label">Notatka / cytat</div>
          <textarea id="note" placeholder="Konkretna obserwacja…"></textarea>
        </div>
      </div>
      <div class="nav">
        <button class="btn ghost" id="prev" ${session.cur === 0 ? 'disabled' : ''}>← Poprzedni</button>
        <div class="hidden-note">🔒 Punkty ukryte — odsłonią się na podsumowaniu</div>
        <button class="btn primary" id="next">${session.cur < blocks.length - 1 ? 'Następny blok →' : 'Zakończ ocenę →'}</button>
      </div>
    </div></div>`;

  (host.querySelector('#note') as HTMLTextAreaElement).value = a.notes[b.id] ?? '';

  host.querySelectorAll<HTMLElement>('.step').forEach((s) => (s.onclick = () => { session.cur = Number(s.dataset.i); renderAssess(host); }));
  host.querySelector('#scale')!.addEventListener('change', (e) => {
    a.marks[b.id] = Number((e.target as HTMLInputElement).value) as Mark; renderAssess(host);
  });
  (host.querySelector('#deepen-asked') as HTMLInputElement).onchange = (e) => { a.deepenAsked[b.id] = (e.target as HTMLInputElement).checked; };
  (host.querySelector('#fr') as HTMLButtonElement).onclick = () => { a.flags[b.id] = { red: !fl.red, green: fl.green }; renderAssess(host); };
  (host.querySelector('#fg') as HTMLButtonElement).onclick = () => { a.flags[b.id] = { red: fl.red, green: !fl.green }; renderAssess(host); };
  (host.querySelector('#note') as HTMLTextAreaElement).oninput = (e) => { a.notes[b.id] = (e.target as HTMLTextAreaElement).value; };
  (host.querySelector('#prev') as HTMLButtonElement).onclick = () => { if (session.cur > 0) { session.cur--; renderAssess(host); } };
  (host.querySelector('#next') as HTMLButtonElement).onclick = () => {
    if (session.cur < blocks.length - 1) { session.cur++; renderAssess(host); } else { navigate('summary'); }
  };
}
