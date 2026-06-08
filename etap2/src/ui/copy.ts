export function htmlToPlain(html: string): string {
  return html
    .replace(/\r/g, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n').map((line) => line.trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
  const originalLabel = button.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add('copied');
    button.textContent = '✓ Skopiowano';
  } catch {
    button.classList.add('failed');
    button.textContent = '× Nie udało się';
  }
  window.setTimeout(() => {
    button.classList.remove('copied', 'failed');
    button.textContent = originalLabel;
  }, 1600);
}
