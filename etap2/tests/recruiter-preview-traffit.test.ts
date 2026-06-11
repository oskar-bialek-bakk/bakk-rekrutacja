import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmptyAssessment } from '../src/domain/model';
import type { Assessment, Settings } from '../src/domain/model';
import { DEFAULT_WEIGHTS } from '../src/domain/weights.config';

const h = vi.hoisted(() => ({
  pushToTraffit: vi.fn(),
  fetchTraffitCandidates: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../src/persistence/traffit-api', () => ({
  pushToTraffit: (x: unknown) => h.pushToTraffit(x),
  TraffitPushError: class extends Error { status = 0; },
}));
vi.mock('../src/persistence/traffit-candidates', () => ({
  fetchTraffitCandidates: () => h.fetchTraffitCandidates(),
}));
vi.mock('../src/state', () => ({
  repo: { save: (a: unknown) => h.save(a) },
  isOnline: true,
}));

import { openRecruiterPreview } from '../src/ui/recruiter-preview-dialog';

function settings(): Settings {
  return { weights: { ...DEFAULT_WEIGHTS }, showScoreLive: false, includeEInScore: false };
}
function makeAssessment(): Assessment {
  const a = createEmptyAssessment('assess-prev-traffit', {
    nameOrId: 'Janina Próbna', date: '2026-06-08', stage1Result: '', stage1Note: '',
  });
  a.marks = { A: 4, B: 5, C: 3, D: 4 };
  a.decision = 'yes';
  return a;
}

beforeEach(() => {
  document.body.innerHTML = '';
  h.pushToTraffit.mockReset();
  h.fetchTraffitCandidates.mockReset();
  h.save.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});
afterEach(() => { document.body.innerHTML = ''; });

describe('openRecruiterPreview — Traffit push', () => {
  it('z traffitId wysyła bez pytania', async () => {
    h.pushToTraffit.mockResolvedValue({ noteId: 1, action: 'created' });
    const a = makeAssessment();
    a.candidate.traffitId = 30;
    a.candidate.recruitmentId = 63;
    void openRecruiterPreview(a, settings());
    (document.querySelector('#recruiter-traffit') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(h.pushToTraffit).toHaveBeenCalledOnce());
    expect(h.pushToTraffit.mock.calls[0][0]).toMatchObject({ employeeId: 30, assessmentId: a.id });
  });

  it('bez traffitId pokazuje picker, auto-match po nazwisku, zapis i push', async () => {
    h.fetchTraffitCandidates.mockResolvedValue([
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Próbna Janina', email: null },
    ]);
    h.pushToTraffit.mockResolvedValue({ noteId: 2, action: 'created' });
    const a = makeAssessment();
    void openRecruiterPreview(a, settings());
    (document.querySelector('#recruiter-traffit') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#traffit-link-pick')).not.toBeNull());
    const sel = document.querySelector('#traffit-link-pick') as HTMLSelectElement;
    expect(sel.value).toBe('30::63');
    (document.querySelector('#traffit-link-confirm') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(h.pushToTraffit).toHaveBeenCalledOnce());
    expect(a.candidate.traffitId).toBe(30);
    // Zapis dwa razy: PRZED pushem (utrwalenie oceny, żeby backend ją znalazł)
    // oraz PO udanym pushu (utrwalenie powiązania traffitId).
    expect(h.save).toHaveBeenCalledTimes(2);
    expect((h.save.mock.calls.at(-1)![0] as Assessment).candidate.traffitId).toBe(30);
  });

  it('gdy push się nie powiedzie, NIE utrwala powiązania i zostawia picker', async () => {
    h.fetchTraffitCandidates.mockResolvedValue([
      { employeeId: 30, recruitmentId: 63, recruitmentName: 'R', fullName: 'Próbna Janina', email: null },
    ]);
    h.pushToTraffit.mockRejectedValue(new Error('boom'));
    const a = makeAssessment();
    void openRecruiterPreview(a, settings());
    (document.querySelector('#recruiter-traffit') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#traffit-link-pick')).not.toBeNull());
    (document.querySelector('#traffit-link-confirm') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(h.pushToTraffit).toHaveBeenCalledOnce());
    // Ocena jest utrwalana PRZED pushem (backend musi ją znaleźć), ale gdy push
    // się nie powiedzie, powiązanie (traffitId) NIE jest zapisywane.
    expect(a.candidate.traffitId).toBeUndefined();
    const savedWithBinding = h.save.mock.calls.some((c) => (c[0] as Assessment).candidate.traffitId != null);
    expect(savedWithBinding).toBe(false);
    expect(document.querySelector('#traffit-link-pick')).not.toBeNull(); // picker nadal otwarty
  });
});
