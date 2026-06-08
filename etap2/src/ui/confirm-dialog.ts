export interface ConfirmOptions {
  title?: string;
  message: string;          // plain text (may contain newlines); rendered safely via textContent
  okLabel?: string;         // default 'Potwierdź'
  cancelLabel?: string;     // default 'Anuluj'
  tone?: 'default' | 'danger';  // danger => OK button styled as destructive
}

/**
 * Wewnątrzaplikacyjny dialog potwierdzenia zastępujący window.confirm.
 * Zwraca true po kliknięciu OK, false po Anuluj, kliknięciu w tło lub Escape.
 * Sprząta nakładkę i nasłuchiwacz keydown przed rozwiązaniem Promise, więc nic nie wycieka.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    okLabel = 'Potwierdź',
    cancelLabel = 'Anuluj',
    tone = 'default',
  } = options;

  return new Promise<boolean>((resolve) => {
    // Zapamiętaj fokus sprzed otwarcia dialogu, aby przywrócić go po zamknięciu.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'modal-title';
      titleEl.id = 'modal-title';
      titleEl.textContent = title;
      dialog.setAttribute('aria-labelledby', 'modal-title');
      dialog.appendChild(titleEl);
    } else {
      // Bez tytułu dialog nadal potrzebuje nazwy dostępnej dla czytników ekranu.
      dialog.setAttribute('aria-label', 'Potwierdzenie');
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'modal-message';
    messageEl.id = 'modal-message';
    messageEl.textContent = message;
    dialog.setAttribute('aria-describedby', 'modal-message');
    dialog.appendChild(messageEl);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'modal-cancel';
    cancelBtn.className = 'btn ghost';
    cancelBtn.textContent = cancelLabel;

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.id = 'modal-ok';
    okBtn.className = tone === 'danger' ? 'btn danger' : 'btn primary';
    okBtn.textContent = okLabel;

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);

    let settled = false;
    const cleanup = (result: boolean): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      // Przywróć fokus na element aktywny sprzed otwarcia dialogu.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      resolve(result);
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    };

    cancelBtn.onclick = () => cleanup(false);
    okBtn.onclick = () => cleanup(true);
    backdrop.onclick = (e: MouseEvent) => {
      if (e.target === backdrop) cleanup(false);
    };
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(backdrop);

    // Fokus na przycisku domyślnym: Anuluj dla danger, OK w pozostałych przypadkach.
    (tone === 'danger' ? cancelBtn : okBtn).focus();
  });
}
