import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/ui/escape';

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(escapeHtml(`a & b`)).toBe('a &amp; b');
    expect(escapeHtml(`it's`)).toBe('it&#39;s');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('preserves Polish diacritics and emoji', () => {
    expect(escapeHtml('zażółć gęślą jaźń 🟢')).toBe('zażółć gęślą jaźń 🟢');
  });

  it('prevents </textarea> DOM break', () => {
    expect(escapeHtml('</textarea><script>x</script>')).toBe(
      '&lt;/textarea&gt;&lt;script&gt;x&lt;/script&gt;',
    );
  });
});
