import './ui/theme.css';
import { navigate, render } from './app';
import { reloadSettings, session } from './state';
import { isRedirectingToLogin } from './auth/access-token';
import { installCrashGuard, maybeRestoreDraft } from './persistence/crash-guard';

// Najpierw maluj UI z defaultowymi ustawieniami, POTEM dociągaj ustawienia w tle.
// Wcześniej `await reloadSettings()` przed render() blokował pierwsze malowanie na
// czas requestu do API — przy zimnym starcie Function App (F1, brak Always On) to
// nawet ~30 s pustego ekranu po zalogowaniu. Ekran startowy nie używa `settings`
// (wagi/score dotyczą dopiero oceny i podsumowania), więc render od razu jest bezpieczny,
// a zanim prowadzący dojdzie do oceny, ustawienia są już wczytane.
render();

// Siatka bezpieczeństwa przed utratą wypełnianej oceny: autosave do localStorage
// + propozycja przywrócenia niezapisanej oceny po przeładowaniu / wygaśnięciu sesji.
installCrashGuard();
void maybeRestoreDraft();

reloadSettings()
  .then(() => {
    // Ustawienia doszły w tle. Odśwież ekran, który z nich korzysta (np. „Ustawienia"
    // pokazujące wagi), ale NIE ekran startowy (reset formularza) ani aktywnej oceny /
    // podsumowania (utrata niezapisanego stanu rozmowy).
    if (session.screen !== 'start' && session.screen !== 'assess' && session.screen !== 'summary') {
      render();
    }
  })
  .catch((err: unknown) => {
    // Relogin Easy Auth to nie awaria — strona już się przekierowuje, nie loguj.
    if (!isRedirectingToLogin(err)) {
      console.error('etap2: nie udało się wczytać ustawień, używam domyślnych', err);
    }
  });

document.getElementById('nav-roster')?.addEventListener('click', () => {
  navigate('roster');
});

document.getElementById('btn-settings')?.addEventListener('click', () => {
  navigate('settings');
});

const brand = document.getElementById('brand');
brand?.addEventListener('click', () => {
  navigate('roster');
});
brand?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    navigate('roster');
  }
});
