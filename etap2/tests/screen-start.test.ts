import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import type { TraffitCandidate } from '../src/domain/traffit-roster';

const h = vi.hoisted(() => ({
  findAll: vi.fn(),
  getVariantUsage: vi.fn(async () => ({})),
  navigate: vi.fn(),
  fetchTraffitCandidates: vi.fn(),
  session: { current: null as unknown, cur: 0, visited: new Set<unknown>(), editing: false },
}));

vi.mock('../src/state', () => ({
  repo: { findAll: () => h.findAll(), getVariantUsage: () => h.getVariantUsage() },
  session: h.session,
  isOnline: true,
}));
vi.mock('../src/app', () => ({ navigate: (s: string) => h.navigate(s), render: vi.fn() }));
vi.mock('../src/ui/migration-banner', () => ({ renderMigrationBanner: vi.fn() }));
vi.mock('../src/ui/timer-ui', () => ({ startTimer: vi.fn() }));
vi.mock('../src/persistence/traffit-candidates', () => ({
  fetchTraffitCandidates: () => h.fetchTraffitCandidates(),
}));

import { renderStart } from '../src/ui/screen-start';

const cand = (employeeId: number, recruitmentId: number, fullName: string): TraffitCandidate =>
  ({ employeeId, recruitmentId, recruitmentName: `R${recruitmentId}`, fullName, email: null });

beforeEach(() => {
  document.body.innerHTML = '';
  h.findAll.mockResolvedValue([]);
  h.fetchTraffitCandidates.mockResolvedValue([cand(10, 63, 'Kowalski Jan'), cand(30, 63, 'Nowak Anna')]);
  h.navigate.mockReset();
  h.session.current = null;
});
afterEach(() => { vi.clearAllMocks(); });

async function flush(): Promise<void> { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe('renderStart dropdown Traffit', () => {
  it('renderuje opcje kandydatów posortowane po employeeId', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const opts = Array.from(host.querySelectorAll('#traffit-pick option')).map((o) => o.textContent);
    expect(opts.some((t) => t?.includes('Kowalski Jan'))).toBe(true);
    expect(opts.some((t) => t?.includes('Nowak Anna') && t?.includes('R63'))).toBe(true);
  });

  it('ukrywa kandydata już dodanego w rosterze (para traffitId+recruitmentId)', async () => {
    h.findAll.mockResolvedValue([createEmptyAssessment('a1', {
      nameOrId: 'Kowalski Jan', date: '', stage1Result: '', stage1Note: '', traffitId: 10, recruitmentId: 63,
    })]);
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const opts = Array.from(host.querySelectorAll('#traffit-pick option')).map((o) => o.textContent ?? '');
    expect(opts.some((t) => t.includes('Kowalski Jan'))).toBe(false);
    expect(opts.some((t) => t.includes('Nowak Anna'))).toBe(true);
  });

  it('wybór z dropdownu zapisuje traffitId/recruitmentId/recruitmentName w sesji po starcie', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    const sel = host.querySelector('#traffit-pick') as HTMLSelectElement;
    sel.value = '30::63';
    sel.dispatchEvent(new Event('change'));
    (host.querySelector('#btn-start') as HTMLButtonElement).click();
    const a = h.session.current as ReturnType<typeof createEmptyAssessment>;
    expect(a.candidate.traffitId).toBe(30);
    expect(a.candidate.recruitmentId).toBe(63);
    expect(a.candidate.recruitmentName).toBe('R63');
    expect(a.candidate.nameOrId).toBe('Nowak Anna');
  });

  it('przełącznik "wprowadź ręcznie" pokazuje pole tekstowe i czyści wybór', async () => {
    const host = document.createElement('div');
    await renderStart(host);
    await flush();
    (host.querySelector('#manual-toggle') as HTMLButtonElement).click();
    const nameField = host.querySelector('#in-name') as HTMLInputElement;
    expect(nameField.closest('.field')?.hasAttribute('hidden')).toBe(false);
    nameField.value = 'Ręczny Kandydat';
    (host.querySelector('#btn-start') as HTMLButtonElement).click();
    const a = h.session.current as ReturnType<typeof createEmptyAssessment>;
    expect(a.candidate.nameOrId).toBe('Ręczny Kandydat');
    expect(a.candidate.traffitId).toBeUndefined();
  });
});
