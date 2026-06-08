import './ui/theme.css';
import { navigate, render } from './app';
import { reloadSettings } from './state';

(async () => {
  await reloadSettings();
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
