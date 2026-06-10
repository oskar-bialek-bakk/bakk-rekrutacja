import './ui/theme.css';
import { navigate, render } from './app';
import { reloadSettings } from './state';
import { isRedirectingToLogin } from './auth/access-token';

(async () => {
  // Ładowanie ustawień NIE może blokować pierwszego renderu. Gdy backend chwilowo
  // nie odpowie (albo trwa relogin), aplikacja i tak musi się pokazać z defaultami,
  // a nie zawisnąć na pustym ekranie (regresja: „nie wstaje póki nie wyczyścisz cookies").
  try {
    await reloadSettings();
  } catch (err) {
    // Relogin Easy Auth to nie awaria — strona już się przekierowuje, nie loguj.
    if (!isRedirectingToLogin(err)) {
      console.error('etap2: nie udało się wczytać ustawień, używam domyślnych', err);
    }
  }
  render();
})();

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
