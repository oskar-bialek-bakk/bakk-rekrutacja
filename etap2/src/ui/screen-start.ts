import { BLOCKS } from '../content/blocks';
import { createEmptyAssessment } from '../domain/model';
import { pickLeastUsed } from '../domain/variants';
import { repo, session } from '../state';
import { navigate } from '../app';
import { startTimer } from './timer-ui';

export async function renderStart(host: HTMLElement): Promise<void> {
  const usage = await repo.getVariantUsage();
  const suggested: Record<string, number> = {};
  for (const b of BLOCKS) suggested[b.id] = pickLeastUsed(usage, b.id, b.variants.length);

  host.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Junior C# / SQL Developer</div>
      <h1>Ustrukturyzowana rozmowa finałowa</h1>
    </section>
    <div class="form">
      <div class="field"><label for="in-name">Kandydat — imię i nazwisko / ID</label><input id="in-name"></div>
      <div class="field two">
        <div><label for="in-date">Data rozmowy</label><input id="in-date" type="date"></div>
        <div><label for="in-stage1">Wynik etapu I</label><input id="in-stage1"></div>
      </div>
      <div class="field"><label for="in-stage1-note">Notatka z etapu I</label><textarea id="in-stage1-note" placeholder="np. mocny SQL, słabszy LINQ"></textarea></div>
      <div id="variant-pick"></div>
      <label class="opt-toggle" id="opt-e"><input type="checkbox" id="chk-e"> Dołącz blok E „podlewanie" (bez wagi)</label>
      <button class="btn primary" id="btn-start">Rozpocznij rozmowę →</button>
    </div>`;

  const displayLabel = (label: string): string => {
    const idx = label.indexOf(' · ');
    return idx >= 0 ? label.slice(idx + 3) : label;
  };

  const vp = host.querySelector('#variant-pick')!;
  vp.innerHTML = BLOCKS.filter((b) => b.variants.length > 1).map((b) => `
    <div class="field"><label>${b.title} — wariant</label>
      <div class="vchips" data-block="${b.id}">
        ${b.variants.map((v, i) => `<button type="button" class="vchip ${i === suggested[b.id] ? 'on' : ''}" data-idx="${i}">${displayLabel(v.label)}</button>`).join('')}
      </div></div>`).join('');

  vp.querySelectorAll<HTMLElement>('.vchips').forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('.vchip').forEach((chip) => {
      chip.onclick = () => {
        row.querySelectorAll('.vchip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      };
    });
  });

  (host.querySelector('#in-date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);

  (host.querySelector('#btn-start') as HTMLButtonElement).onclick = () => {
    const a = createEmptyAssessment(crypto.randomUUID(), {
      nameOrId: (host.querySelector('#in-name') as HTMLInputElement).value || '(bez nazwy)',
      date: (host.querySelector('#in-date') as HTMLInputElement).value,
      stage1Result: (host.querySelector('#in-stage1') as HTMLInputElement).value,
      stage1Note: (host.querySelector('#in-stage1-note') as HTMLTextAreaElement).value,
    });
    a.useE = (host.querySelector('#chk-e') as HTMLInputElement).checked;
    for (const b of BLOCKS) {
      const sel = vp.querySelector(`.vchips[data-block="${b.id}"] .vchip.on`) as HTMLElement | null;
      a.selectedVariants[b.id] = sel ? Number(sel.dataset.idx) : (suggested[b.id] ?? 0);
    }
    session.current = a;
    session.cur = 0;
    session.visited = new Set();
    startTimer();
    navigate('assess');
  };
}
