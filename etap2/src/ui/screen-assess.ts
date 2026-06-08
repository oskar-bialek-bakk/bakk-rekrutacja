import { BLOCKS } from '../content/blocks';
import type { Block } from '../content/blocks';
import type { BlockId, Mark } from '../domain/model';
import { session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';

function activeBlocks(): Block[] {
  return BLOCKS.filter((b) => !b.optional || session.current!.useE);
}

function stepStateClass(blockId: BlockId, idx: number): 'done' | 'active' | 'todo' {
  const a = session.current!;
  if (a.marks[blockId] != null) return 'done';
  if (idx === session.cur) return 'active';
  return 'todo';
}

export function renderAssess(host: HTMLElement): void {
  const a = session.current!;
  const blocks = activeBlocks();
  if (session.cur >= blocks.length) session.cur = blocks.length - 1;
  const b = blocks[session.cur];
  const vIdx = a.selectedVariants[b.id] ?? 0;
  const sel = a.marks[b.id];
  const fl = a.flags[b.id] ?? { red: false, green: false };
  const asked = a.askedQuestions[b.id] ?? {};
  const correct = b.variantAnswers?.[vIdx];

  const questionsHtml = b.questions
    ? `<div class="qlist-label">Pula pytań — zaznacz zadane (wybierz 3–4)</div>
       <div class="qlist">${b.questions
         .map((q, i) => `<label class="qitem ${asked[i] ? 'on' : ''}" data-q="${i}">
           <input type="checkbox" ${asked[i] ? 'checked' : ''}>
           <span><b>${i + 1}.</b> ${escapeHtml(q)}</span>
         </label>`)
         .join('')}</div>`
    : '';

  // Block z pulą pytań (D) nie potrzebuje osobnego readboxa — pula sama w sobie jest treścią do przeczytania.
  const readboxHtml = b.questions
    ? ''
    : `<div class="label">Przeczytaj kandydatowi</div>
       <div class="readbox">${b.variants[vIdx].read}</div>`;

  host.innerHTML = `
    <div class="stepper">${blocks.map((x, i) => {
      const state = stepStateClass(x.id, i);
      return `<button class="step ${state}" data-i="${i}"><div class="k">${x.key}</div><div class="t">${x.title}</div></button>`;
    }).join('')}</div>
    <div class="card"><div class="card-body">
      <div class="twocol">
        <div>
          ${readboxHtml}
          ${questionsHtml}
          <div class="label" style="margin-top:18px">Ocena — wybierz poziom</div>
          <fieldset class="scale" id="scale">${b.scale.map((d, i) =>
            `<label class="lvl ${sel === i + 1 ? 'sel' : ''}" data-lvl="${i + 1}"><input type="radio" name="mark" value="${i + 1}" ${sel === i + 1 ? 'checked' : ''}><span class="num">${i + 1}</span><span class="desc">${d}</span></label>`).join('')}</fieldset>
          <label class="deepen ${a.deepenAsked[b.id] ? 'is-asked' : ''}" id="deepen-box">
            <div class="dh">Pytanie pogłębiające <span class="tag">jeśli zostanie czas</span></div>
            <div class="dq">„${b.deepen}”</div>
            <div class="check"><input type="checkbox" id="deepen-asked" ${a.deepenAsked[b.id] ? 'checked' : ''}><span class="lbl">zadano</span></div>
          </label>
        </div>
        <div>
          <div class="keybox"><h4>${b.keyTitle}</h4>
            <ul>${b.keys.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul>
            ${correct ? `<div class="key-answer">Poprawny wynik (${escapeHtml(b.variants[vIdx].label)}): <b>${escapeHtml(correct)}</b></div>` : ''}
            <div class="flags-divider"></div>
            <div class="flag red">${escapeHtml(b.flagRed)}</div>
            <div class="flag green">${escapeHtml(b.flagGreen)}</div>
          </div>
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

  const stepEls = Array.from(host.querySelectorAll<HTMLElement>('.step'));
  stepEls.forEach((s) => (s.onclick = () => { session.cur = Number(s.dataset.i); renderAssess(host); }));

  const refreshStepper = () => {
    blocks.forEach((x, i) => {
      const el = stepEls[i];
      const state = stepStateClass(x.id, i);
      el.classList.remove('done', 'active', 'todo');
      el.classList.add(state);
    });
  };

  host.querySelector('#scale')!.addEventListener('change', (e) => {
    const value = Number((e.target as HTMLInputElement).value) as Mark;
    a.marks[b.id] = value;
    host.querySelectorAll<HTMLElement>('#scale .lvl').forEach((lvl) => {
      lvl.classList.toggle('sel', Number(lvl.dataset.lvl) === value);
    });
    refreshStepper();
  });

  const deepenBox = host.querySelector('#deepen-box') as HTMLElement;
  const deepenCb = host.querySelector('#deepen-asked') as HTMLInputElement;
  deepenCb.onchange = () => {
    a.deepenAsked[b.id] = deepenCb.checked;
    deepenBox.classList.toggle('is-asked', deepenCb.checked);
  };

  const fr = host.querySelector('#fr') as HTMLButtonElement;
  const fg = host.querySelector('#fg') as HTMLButtonElement;
  fr.onclick = () => {
    const cur = a.flags[b.id] ?? { red: false, green: false };
    const next = { red: !cur.red, green: cur.green };
    a.flags[b.id] = next;
    fr.classList.toggle('on', next.red);
  };
  fg.onclick = () => {
    const cur = a.flags[b.id] ?? { red: false, green: false };
    const next = { red: cur.red, green: !cur.green };
    a.flags[b.id] = next;
    fg.classList.toggle('on', next.green);
  };

  if (b.questions) {
    host.querySelectorAll<HTMLLabelElement>('.qitem').forEach((item) => {
      const cb = item.querySelector('input[type=checkbox]') as HTMLInputElement;
      cb.onchange = () => {
        const idx = Number(item.dataset.q);
        const cur = a.askedQuestions[b.id] ?? {};
        a.askedQuestions[b.id] = { ...cur, [idx]: cb.checked };
        item.classList.toggle('on', cb.checked);
      };
    });
  }

  (host.querySelector('#note') as HTMLTextAreaElement).oninput = (e) => {
    a.notes[b.id] = (e.target as HTMLTextAreaElement).value;
  };

  (host.querySelector('#prev') as HTMLButtonElement).onclick = () => {
    if (session.cur > 0) { session.cur--; renderAssess(host); }
  };
  (host.querySelector('#next') as HTMLButtonElement).onclick = () => {
    if (session.cur < blocks.length - 1) { session.cur++; renderAssess(host); } else { navigate('summary'); }
  };
}
