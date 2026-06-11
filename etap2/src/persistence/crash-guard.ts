import { session } from '../state';
import { navigate } from '../app';
import { startTimer } from '../ui/timer-ui';
import { confirmDialog } from '../ui/confirm-dialog';
import { clearDraft, readDraft, writeDraft } from './draft';

/**
 * Spina draft (localStorage) z cyklem życia aplikacji:
 *  - autosave bieżącej oceny co AUTOSAVE_MS oraz przy ukryciu / zamknięciu karty,
 *  - przywrócenie niezapisanej oceny przy starcie.
 *
 * Cel: ocena wypełniana w trakcie rozmowy żyje tylko w session.current (pamięć).
 * Każdy redirect na logowanie (wygasła sesja Easy Auth), reload czy zamknięcie karty
 * kasował ten stan. Draft to tania, beztokenowa kopia, która to przeżywa.
 */
const AUTOSAVE_MS = 5000;

/** Ekrany, na których trwa wypełnianie oceny i warto zrzucać draft. */
function isActiveEditingScreen(): boolean {
  return session.screen === 'intro' || session.screen === 'assess' || session.screen === 'summary';
}

/** Zrzuca bieżącą ocenę do draftu, jeśli jakaś jest wypełniana. */
export function flushDraft(): void {
  if (session.current && isActiveEditingScreen()) {
    writeDraft(session.current);
  }
}

export function installCrashGuard(): void {
  window.setInterval(flushDraft, AUTOSAVE_MS);
  // pagehide łapie nawigację (w tym redirect na login) i zamknięcie karty;
  // visibilitychange łapie przełączenie / zminimalizowanie. localStorage.setItem
  // jest synchroniczny, więc zdąży zapisać przed wyładowaniem strony.
  window.addEventListener('pagehide', flushDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDraft();
  });
}

function formatSavedAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return ` z ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Na starcie: jeśli jest niezapisany draft, zaproponuj przywrócenie.
 * Przywrócenie wczytuje ocenę do sesji i wraca na ekran oceny (timer wznawia się
 * od zapisanego elapsedSec). Odrzucenie czyści draft.
 */
export async function maybeRestoreDraft(): Promise<void> {
  const draft = readDraft();
  if (!draft) return;

  const name = draft.assessment.candidate.nameOrId || 'bez nazwy';
  const restore = await confirmDialog({
    title: 'Przywrócić niezapisaną ocenę?',
    message: `Znaleziono niezapisaną ocenę kandydata „${name}"${formatSavedAt(draft.savedAt)}.\n\nPrzywrócić ją i kontynuować, czy zacząć od nowa?`,
    okLabel: 'Przywróć',
    cancelLabel: 'Odrzuć',
  });

  if (!restore) {
    clearDraft();
    return;
  }

  session.current = draft.assessment;
  session.cur = 0;
  session.visited = new Set();
  session.editing = false;
  navigate('assess');
  startTimer();
}
