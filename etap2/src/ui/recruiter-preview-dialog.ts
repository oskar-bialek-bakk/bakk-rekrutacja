import type { Assessment, Settings } from '../domain/model';
import { buildRecruiterSummary } from '../domain/recruiter-summary';
import { TraffitPushError, pushToTraffit } from '../persistence/traffit-api';
import { fetchTraffitCandidates } from '../persistence/traffit-candidates';
import { bestNameMatch, type TraffitCandidate } from '../domain/traffit-roster';
import { isOnline, repo } from '../state';
import { escapeHtml } from './escape';

const COPIED_LABEL = '✓ Skopiowano';
const COPIED_MS = 1500;

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyHtmlSafe(html: string, text: string): Promise<boolean> {
  // Spróbuj zapisać HTML i tekst równolegle (text/html + text/plain).
  // ClipboardItem może nie być dostępny (jsdom, starsze przeglądarki); wtedy fallback do writeText(html).
  const clip = navigator.clipboard as Clipboard & {
    write?: (data: ClipboardItem[]) => Promise<void>;
  };
  const ItemCtor = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (typeof clip.write === 'function' && typeof ItemCtor === 'function') {
    try {
      const item = new ItemCtor({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await clip.write([item]);
      return true;
    } catch {
      // przejdź do fallbacku
    }
  }
  try {
    await navigator.clipboard.writeText(html);
    return true;
  } catch {
    return false;
  }
}

function flashLabel(btn: HTMLButtonElement, original: string, ok: boolean): void {
  btn.textContent = ok ? COPIED_LABEL : '× Nie udało się';
  btn.classList.add(ok ? 'copied' : 'failed');
  window.setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('copied', 'failed');
  }, COPIED_MS);
}

export function openRecruiterPreview(a: Assessment, s: Settings): Promise<void> {
  const { text, html } = buildRecruiterSummary(a, s);

  return new Promise<void>((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog preview';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Podsumowanie dla rekrutera');

    const titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.id = 'recruiter-preview-title';
    titleEl.textContent = 'Podsumowanie dla rekrutera';
    dialog.setAttribute('aria-labelledby', 'recruiter-preview-title');
    dialog.appendChild(titleEl);

    const preview = document.createElement('div');
    preview.className = 'recruiter-preview';
    // html pochodzi z buildRecruiterSummary: wszystkie dynamiczne wartości są tam już escape'owane.
    preview.innerHTML = html;
    dialog.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const copyTextBtn = document.createElement('button');
    copyTextBtn.type = 'button';
    copyTextBtn.id = 'recruiter-copy-text';
    copyTextBtn.className = 'btn primary';
    copyTextBtn.textContent = 'Kopiuj jako tekst';

    const copyHtmlBtn = document.createElement('button');
    copyHtmlBtn.type = 'button';
    copyHtmlBtn.id = 'recruiter-copy-html';
    copyHtmlBtn.className = 'btn ghost';
    copyHtmlBtn.textContent = 'Kopiuj jako HTML';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'recruiter-close';
    closeBtn.className = 'btn ghost';
    closeBtn.textContent = 'Zamknij';

    const traffitBtn = document.createElement('button');
    traffitBtn.type = 'button';
    traffitBtn.id = 'recruiter-traffit';
    traffitBtn.className = 'btn ghost';
    traffitBtn.textContent = 'Wyślij do Traffit';
    traffitBtn.hidden = !isOnline;

    actions.appendChild(copyHtmlBtn);
    actions.appendChild(copyTextBtn);
    actions.appendChild(traffitBtn);
    actions.appendChild(closeBtn);

    const traffitStatus = document.createElement('div');
    traffitStatus.className = 'traffit-status';
    traffitStatus.setAttribute('aria-live', 'polite');
    traffitStatus.hidden = true;
    dialog.appendChild(actions);
    dialog.appendChild(traffitStatus);
    backdrop.appendChild(dialog);

    let settled = false;
    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      resolve();
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
      }
    };

    copyTextBtn.onclick = async () => {
      const original = 'Kopiuj jako tekst';
      const ok = await copyTextSafe(text);
      flashLabel(copyTextBtn, original, ok);
    };
    copyHtmlBtn.onclick = async () => {
      const original = 'Kopiuj jako HTML';
      const ok = await copyHtmlSafe(html, text);
      flashLabel(copyHtmlBtn, original, ok);
    };
    async function doPush(employeeId: number): Promise<boolean> {
      traffitBtn.disabled = true;
      traffitStatus.hidden = false;
      traffitStatus.textContent = 'Wysyłam do Traffit…';
      try {
        // Backend pushu czyta ocenę z Cosmos po (id, upn). Upewnij się, że jest
        // utrwalona ZANIM wyślemy push — inaczej dostaniemy „Assessment not found
        // in user partition" (ocena otwarta w podglądzie bywała jeszcze niezapisana).
        await repo.save(a);
        const result = await pushToTraffit({ assessmentId: a.id, employeeId, html });
        traffitStatus.textContent = `Gotowe: notatka ${result.action === 'created' ? 'utworzona' : 'zaktualizowana'} (id ${result.noteId}).`;
        return true;
      } catch (err) {
        const msg = err instanceof TraffitPushError
          ? `Błąd ${err.status}: ${err.message}`
          : err instanceof Error ? err.message : 'Nieznany błąd';
        traffitStatus.textContent = `Push się nie powiódł. ${msg}`;
        return false;
      } finally {
        traffitBtn.disabled = false;
      }
    }

    function renderLinkPicker(candidates: TraffitCandidate[]): void {
      // Picker: wybór kandydata z Traffit (auto-match po nazwisku) + furtka ręcznego ID.
      const existing = dialog.querySelector('.traffit-linker');
      if (existing) existing.remove();
      const box = document.createElement('div');
      box.className = 'traffit-linker';
      const best = bestNameMatch(candidates, a.candidate.nameOrId);
      const options = candidates
        .map((c) => {
          const sel = best && c.employeeId === best.employeeId && c.recruitmentId === best.recruitmentId ? ' selected' : '';
          const value = escapeHtml(`${c.employeeId}::${c.recruitmentId}`);
          const label = escapeHtml(`${c.fullName} — ${c.recruitmentName}`);
          return `<option value="${value}"${sel}>${label}</option>`;
        })
        .join('');
      box.innerHTML = `
        <label for="traffit-link-pick">Powiąż z kandydatem w Traffit</label>
        <select id="traffit-link-pick"><option value="">— ręczne ID —</option>${options}</select>
        <input id="traffit-link-manual" inputmode="numeric" placeholder="lub wpisz ID ręcznie">
        <button type="button" class="btn primary" id="traffit-link-confirm">Powiąż i wyślij</button>`;
      traffitStatus.hidden = true;
      dialog.insertBefore(box, traffitStatus);

      (box.querySelector('#traffit-link-confirm') as HTMLButtonElement).onclick = async () => {
        const selVal = (box.querySelector('#traffit-link-pick') as HTMLSelectElement).value;
        const manual = (box.querySelector('#traffit-link-manual') as HTMLInputElement).value.trim();
        let employeeId: number | null = null;
        let chosen: TraffitCandidate | null = null;
        if (selVal) {
          chosen = candidates.find((c) => `${c.employeeId}::${c.recruitmentId}` === selVal) ?? null;
          employeeId = chosen ? chosen.employeeId : null;
        } else if (manual) {
          const n = Number(manual);
          if (Number.isInteger(n) && n > 0) employeeId = n;
        }
        if (employeeId == null) {
          traffitStatus.hidden = false;
          traffitStatus.textContent = 'Wybierz kandydata z listy lub podaj poprawne ID.';
          return;
        }
        // Najpierw push. Powiązanie utrwalamy DOPIERO po sukcesie, żeby błędne
        // ID / nieudany push nie zostawił oceny trwale powiązanej z błędnym
        // traffitId (i nie omijał pickera przy kolejnych próbach).
        const ok = await doPush(employeeId);
        if (!ok) return; // picker zostaje otwarty do korekty
        a.candidate = {
          ...a.candidate,
          traffitId: employeeId,
          ...(chosen ? { recruitmentId: chosen.recruitmentId, recruitmentName: chosen.recruitmentName } : {}),
        };
        try { await repo.save(a); } catch { /* zapis best-effort; notatka już wysłana */ }
        box.remove();
      };
    }

    traffitBtn.onclick = async () => {
      if (typeof a.candidate.traffitId === 'number') {
        await doPush(a.candidate.traffitId);
        return;
      }
      traffitBtn.disabled = true;
      traffitStatus.hidden = false;
      traffitStatus.textContent = 'Pobieram listę kandydatów z Traffit…';
      try {
        const candidates = await fetchTraffitCandidates();
        traffitBtn.disabled = false;
        if (candidates.length === 0) {
          traffitStatus.textContent = 'Brak kandydatów na etapie „Spotkanie BK". Sprawdź ID w Traffit.';
          return;
        }
        renderLinkPicker(candidates);
      } catch (err) {
        traffitBtn.disabled = false;
        const msg = err instanceof Error ? err.message : 'nieznany błąd';
        traffitStatus.textContent = `Nie udało się pobrać listy. ${msg}`;
      }
    };
    closeBtn.onclick = () => cleanup();
    backdrop.onclick = (e: MouseEvent) => {
      if (e.target === backdrop) cleanup();
    };
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(backdrop);
    closeBtn.focus();
  });
}
