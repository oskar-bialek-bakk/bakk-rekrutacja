import { INTRO_QUESTIONS } from '../content/interview-questions';
import { repo, session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';
import { confirmDialog } from './confirm-dialog';
import { qnaEditableListHtml, bindQnaEditable } from './qna';

// Ekran „Wywiad otwierający" — pytania wstępne zadawane na początku rozmowy.
// Zegar już leci (startTimer odpalany na ekranie startowym). Notatki i sygnały
// nie wchodzą do punktacji bloków A-E; służą jako kontekst i materiał do podsumowania.
export function renderIntro(host: HTMLElement): void {
  const a = session.current!;
  const editing = session.editing;

  const editSaveBtn = editing ? '<button class="btn primary" id="intro-save">Zapisz zmiany</button>' : '';

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="meta">Wywiad otwierający · ${escapeHtml(a.candidate.nameOrId)}</div>
          <h2>Pytania wstępne</h2>
        </div>
      </div>
      <div class="card-body">
        <p class="qna-lead">Krótka rozgrzewka przed blokami oceny. Zaznacz zaobserwowane sygnały i dopisz notatkę — to kontekst rozmowy, nie liczy się do punktacji, trafia do podsumowania dla rekrutera.</p>
        ${qnaEditableListHtml(INTRO_QUESTIONS, a, 'intro')}
        <div class="nav">
          <button class="btn ghost" id="intro-back">← ${editing ? 'Wróć do szczegółów' : 'Wróć do ustawień'}</button>
          ${editSaveBtn}
          <button class="btn primary" id="intro-next">Przejdź do oceny →</button>
        </div>
      </div>
    </div>`;

  bindQnaEditable(host, a, 'intro');

  (host.querySelector('#intro-back') as HTMLButtonElement).onclick = () => {
    if (editing) {
      session.detailId = a.id;
      navigate('detail');
    } else {
      navigate('start');
    }
  };

  (host.querySelector('#intro-next') as HTMLButtonElement).onclick = () => navigate('assess');

  const saveBtn = host.querySelector('#intro-save') as HTMLButtonElement | null;
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        await repo.save(a);
        session.editing = false;
        session.detailId = a.id;
        navigate('detail');
      } catch (error: unknown) {
        console.error('Zapis zmian (wstęp) nie powiódł się', error);
        await confirmDialog({
          title: 'Błąd zapisu',
          message: 'Nie udało się zapisać zmian. Spróbuj ponownie.',
          okLabel: 'OK',
          cancelLabel: 'Anuluj',
          tone: 'danger',
        });
      }
    };
  }
}
