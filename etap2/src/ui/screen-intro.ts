import { INTRO_QUESTIONS } from '../content/interview-questions';
import { session } from '../state';
import { navigate } from '../app';
import { escapeHtml } from './escape';

// Ekran „Wywiad otwierający" — pytania wstępne zadawane na początku rozmowy.
// Zegar już leci (startTimer odpalany na ekranie startowym). Notatki nie wchodzą
// do punktacji bloków A-E; służą jako kontekst i materiał do podsumowania.
export function renderIntro(host: HTMLElement): void {
  const a = session.current!;

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="meta">Wywiad otwierający · ${escapeHtml(a.candidate.nameOrId)}</div>
          <h2>Pytania wstępne</h2>
        </div>
      </div>
      <div class="card-body">
        <p class="qna-lead">Krótka rozgrzewka przed blokami oceny. Notatki nie liczą się do punktacji, służą jako kontekst rozmowy i trafiają do podsumowania dla rekrutera.</p>
        <div class="qna-list">
          ${INTRO_QUESTIONS.map((q) => `
            <div class="qna-item">
              <div class="qna-q">${escapeHtml(q.question)}</div>
              ${q.hint ? `<div class="qna-hint">${escapeHtml(q.hint)}</div>` : ''}
              <textarea class="qna-input" data-q="${escapeHtml(q.id)}" placeholder="Notatka z odpowiedzi…"></textarea>
            </div>`).join('')}
        </div>
        <div class="nav">
          <button class="btn ghost" id="intro-back">← Wróć do ustawień</button>
          <button class="btn primary" id="intro-next">Przejdź do oceny →</button>
        </div>
      </div>
    </div>`;

  host.querySelectorAll<HTMLTextAreaElement>('.qna-input').forEach((ta) => {
    const id = ta.dataset.q!;
    ta.value = a.intro[id] ?? '';
    ta.oninput = () => { a.intro[id] = ta.value; };
  });

  (host.querySelector('#intro-back') as HTMLButtonElement).onclick = () => navigate('start');
  (host.querySelector('#intro-next') as HTMLButtonElement).onclick = () => navigate('assess');
}
