import { describe, it, expect } from 'vitest';
import { htmlToPlain } from '../src/ui/copy';

describe('htmlToPlain', () => {
  it('konwertuje proste <p>', () => {
    expect(htmlToPlain('<p>Hello</p><p>World</p>')).toBe('Hello\n\nWorld');
  });

  it('listy <ul><li> renderuje jako bullety', () => {
    const html = '<p>Elementy:</p><ul><li>rura</li><li>trójniki</li><li>emitery</li></ul>';
    expect(htmlToPlain(html)).toBe('Elementy:\n\n• rura\n• trójniki\n• emitery');
  });

  it('zachowuje treść wewnątrz <span>/<b>/<i>', () => {
    expect(htmlToPlain('<p>To jest <b>ważne</b> i <span class="mono">kod</span>.</p>')).toBe('To jest ważne i kod.');
  });

  it('konwertuje encje HTML', () => {
    expect(htmlToPlain('<p>a&nbsp;b &amp; c &lt;d&gt; &quot;e&quot; &#39;f&#39;</p>')).toBe('a b & c <d> "e" \'f\'');
  });

  it('konwertuje <br> na newline', () => {
    expect(htmlToPlain('Linia 1<br>Linia 2<br/>Linia 3')).toBe('Linia 1\nLinia 2\nLinia 3');
  });

  it('nie zostawia więcej niż 2 puste linie pod rząd', () => {
    expect(htmlToPlain('<p>A</p><p></p><p></p><p>B</p>')).toBe('A\n\nB');
  });
});
