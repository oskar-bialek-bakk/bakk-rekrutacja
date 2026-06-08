import './ui/theme.css';
import { navigate, render } from './app';

render();

document.getElementById('nav-roster')?.addEventListener('click', () => {
  navigate('roster');
});

document.getElementById('brand')?.addEventListener('click', () => {
  navigate('roster');
});
