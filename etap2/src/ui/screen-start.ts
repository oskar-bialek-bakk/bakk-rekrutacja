import { BLOCKS } from '../content/blocks';
import { createEmptyAssessment } from '../domain/model';
import { pickLeastUsed } from '../domain/variants';
import { isOnline, repo, session } from '../state';
import { selectableCandidates, type TraffitCandidate } from '../domain/traffit-roster';
import { fetchTraffitCandidates } from '../persistence/traffit-candidates';
import { navigate, render } from '../app';
import { startTimer } from './timer-ui';
import { renderMigrationBanner } from './migration-banner';

export async function renderStart(host: HTMLElement): Promise<void> {
  const usage = await repo.getVariantUsage();
  const suggested: Record<string, number> = {};
  for (const b of BLOCKS) suggested[b.id] = pickLeastUsed(usage, b.id, b.variants.length);

  host.innerHTML = `
    <div id="migration-host"></div>
    <section class="hero">
      <div class="eyebrow">Junior C# / SQL Developer</div>
      <h1>Ustrukturyzowana rozmowa finałowa</h1>
    </section>
    <div class="form">
      <div class="field" id="traffit-pick-field" hidden>
        <label for="traffit-pick">Kandydat z Traffit (etap Spotkanie BK)</label>
        <select id="traffit-pick"><option value="">— wybierz kandydata —</option></select>
        <button type="button" class="btn ghost manual-link" id="manual-toggle" title="Wprowadź dane ręcznie">✎ wprowadź ręcznie</button>
        <div id="traffit-pick-status" class="hint"></div>
      </div>
      <div class="field" id="manual-name-field"><label for="in-name">Kandydat — imię i nazwisko / ID</label><input id="in-name"></div>
      <div class="field two">
        <div><label for="in-date">Data rozmowy</label><input id="in-date" type="date"></div>
        <div><label for="in-stage1">Wynik etapu I</label><input id="in-stage1"></div>
      </div>
      <div class="field"><label for="in-stage1-note">Notatka z etapu I</label><textarea id="in-stage1-note" placeholder="np. mocny SQL, słabszy LINQ"></textarea></div>
      <div id="variant-pick"></div>
      <label class="opt-toggle" id="opt-a-chart"><input type="checkbox" id="chk-a-chart"> Tryb A: wykres (zamiast algorytmu)</label>
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
        if (chip.disabled) return;
        row.querySelectorAll('.vchip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      };
    });
  });

  const chkChart = host.querySelector('#chk-a-chart') as HTMLInputElement;
  const refreshAChips = (): void => {
    const aRow = vp.querySelector<HTMLElement>('.vchips[data-block="A"]');
    if (!aRow) return;
    aRow.classList.toggle('disabled', chkChart.checked);
    aRow.querySelectorAll<HTMLButtonElement>('.vchip').forEach((chip) => {
      chip.disabled = chkChart.checked;
    });
  };
  chkChart.onchange = refreshAChips;
  refreshAChips();

  (host.querySelector('#in-date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);

  const migrationHost = host.querySelector('#migration-host') as HTMLElement | null;
  if (migrationHost) {
    renderMigrationBanner(migrationHost, {
      repo,
      reload: () => render(),
      onImported: () => navigate('roster'),
    });
  }

  // Wybrany kandydat z Traffit (null = tryb ręczny / brak wyboru).
  let picked: TraffitCandidate | null = null;

  const traffitField = host.querySelector('#traffit-pick-field') as HTMLElement;
  const manualField = host.querySelector('#manual-name-field') as HTMLElement;
  const pickSelect = host.querySelector('#traffit-pick') as HTMLSelectElement;
  const pickStatus = host.querySelector('#traffit-pick-status') as HTMLElement;
  const nameInput = host.querySelector('#in-name') as HTMLInputElement;

  const showManual = (): void => {
    picked = null;
    traffitField.hidden = true;
    manualField.hidden = false;
    nameInput.focus();
  };

  (host.querySelector('#manual-toggle') as HTMLButtonElement).onclick = showManual;

  if (isOnline) {
    // Domyślnie ukryj pole ręczne; pokaż dropdown po załadowaniu listy.
    manualField.hidden = true;
    traffitField.hidden = false;
    pickStatus.textContent = 'Ładuję kandydatów z Traffit…';
    void (async () => {
      try {
        const [all, assessments] = await Promise.all([fetchTraffitCandidates(), repo.findAll()]);
        const list = selectableCandidates(all, assessments);
        if (list.length === 0) {
          pickStatus.textContent = 'Brak kandydatów na etapie „Spotkanie BK". Wprowadź dane ręcznie.';
          showManual();
          return;
        }
        const byKey = new Map<string, TraffitCandidate>();
        for (const c of list) {
          const key = `${c.employeeId}::${c.recruitmentId}`;
          byKey.set(key, c);
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = `${c.fullName} — ${c.recruitmentName}`;
          pickSelect.appendChild(opt);
        }
        pickStatus.textContent = '';
        pickSelect.onchange = () => {
          picked = byKey.get(pickSelect.value) ?? null;
          if (picked) nameInput.value = picked.fullName;
        };
      } catch {
        pickStatus.textContent = 'Nie udało się pobrać listy z Traffit. Wprowadź dane ręcznie.';
        showManual();
      }
    })();
  }

  (host.querySelector('#btn-start') as HTMLButtonElement).onclick = () => {
    const a = createEmptyAssessment(crypto.randomUUID(), {
      nameOrId: (host.querySelector('#in-name') as HTMLInputElement).value || picked?.fullName || '(bez nazwy)',
      date: (host.querySelector('#in-date') as HTMLInputElement).value,
      stage1Result: (host.querySelector('#in-stage1') as HTMLInputElement).value,
      stage1Note: (host.querySelector('#in-stage1-note') as HTMLTextAreaElement).value,
      ...(picked
        ? { traffitId: picked.employeeId, recruitmentId: picked.recruitmentId, recruitmentName: picked.recruitmentName }
        : {}),
    });
    a.useE = (host.querySelector('#chk-e') as HTMLInputElement).checked;
    a.useAChart = chkChart.checked;
    for (const b of BLOCKS) {
      const sel = vp.querySelector(`.vchips[data-block="${b.id}"] .vchip.on`) as HTMLElement | null;
      a.selectedVariants[b.id] = sel ? Number(sel.dataset.idx) : (suggested[b.id] ?? 0);
    }
    session.current = a;
    session.cur = 0;
    session.visited = new Set();
    session.editing = false;
    startTimer();
    navigate('assess');
  };
}
