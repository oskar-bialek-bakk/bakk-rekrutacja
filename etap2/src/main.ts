import './ui/theme.css';
import { navigate, render } from './app';

render();

document.getElementById('nav-roster')?.addEventListener('click', () => {
  navigate('roster');
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
