import type { Assessment, Settings } from '../domain/model';
import { buildRecruiterSummary } from '../domain/recruiter-summary';

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

    actions.appendChild(copyHtmlBtn);
    actions.appendChild(copyTextBtn);
    actions.appendChild(closeBtn);
    dialog.appendChild(actions);
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
    closeBtn.onclick = () => cleanup();
    backdrop.onclick = (e: MouseEvent) => {
      if (e.target === backdrop) cleanup();
    };
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(backdrop);
    closeBtn.focus();
  });
}
