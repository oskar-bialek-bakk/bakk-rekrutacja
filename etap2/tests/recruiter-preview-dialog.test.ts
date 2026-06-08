import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import type { Assessment, Settings } from '../src/domain/model';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';
import { openRecruiterPreview } from '../src/ui/recruiter-preview-dialog';

function settings(): Settings {
  return { weights: { ...DEFAULT_WEIGHTS }, showScoreLive: false, includeEInScore: false };
}

function makeAssessment(): Assessment {
  const a = createEmptyAssessment('assess-prev-1', {
    nameOrId: 'Janina Próbna',
    date: '2026-06-08',
    stage1Result: '',
    stage1Note: '',
  });
  a.marks = { A: 4, B: 5, C: 3, D: 4 };
  a.decision = 'yes';
  return a;
}

interface ClipboardStub {
  writeText: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
}

let clipboardStub: ClipboardStub;

beforeEach(() => {
  document.body.innerHTML = '';
  clipboardStub = {
    writeText: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboardStub,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('openRecruiterPreview', () => {
  it('renderuje dialog z podglądem zawierającym nazwę kandydata', () => {
    const a = makeAssessment();
    void openRecruiterPreview(a, settings());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const preview = document.querySelector('.recruiter-preview');
    expect(preview).not.toBeNull();
    expect(preview?.textContent ?? '').toContain('Janina Próbna');
  });

  it('przycisk "Kopiuj jako tekst" wywołuje writeText z tekstem zawierającym Wynik', async () => {
    const a = makeAssessment();
    void openRecruiterPreview(a, settings());
    const btn = document.querySelector('#recruiter-copy-text') as HTMLButtonElement;
    btn.click();
    // poczekaj na mikrotaski (Promise.resolve)
    await Promise.resolve();
    await Promise.resolve();
    expect(clipboardStub.writeText).toHaveBeenCalledTimes(1);
    const arg = clipboardStub.writeText.mock.calls[0][0] as string;
    expect(arg).toContain('Wynik');
    expect(arg).toContain('Janina Próbna');
  });

  it('przycisk "Kopiuj jako HTML" próbuje navigator.clipboard.write i wkłada HTML', async () => {
    const a = makeAssessment();
    void openRecruiterPreview(a, settings());
    // Symuluj brak ClipboardItem → fallback do writeText(html).
    const prev = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
    const btn = document.querySelector('#recruiter-copy-html') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(clipboardStub.writeText).toHaveBeenCalledTimes(1);
    const arg = clipboardStub.writeText.mock.calls[0][0] as string;
    expect(arg).toContain('<h3>');
    if (prev) (globalThis as { ClipboardItem?: unknown }).ClipboardItem = prev;
  });

  it('klik "Zamknij" usuwa modal-backdrop z DOM i rozwiązuje Promise', async () => {
    const a = makeAssessment();
    const p = openRecruiterPreview(a, settings());
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    (document.querySelector('#recruiter-close') as HTMLButtonElement).click();
    await p;
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('Escape zamyka dialog', async () => {
    const a = makeAssessment();
    const p = openRecruiterPreview(a, settings());
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await p;
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });
});
