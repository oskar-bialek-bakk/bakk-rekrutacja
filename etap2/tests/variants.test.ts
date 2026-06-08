import { describe, it, expect } from 'vitest';
import { pickLeastUsed, recordUsage } from '../src/domain/variants';

describe('pickLeastUsed', () => {
  it('pusty licznik → indeks 0', () => {
    expect(pickLeastUsed({}, 'A', 3)).toBe(0);
  });
  it('wybiera najmniej używany wariant', () => {
    const usage = { A: { 0: 5, 1: 2, 2: 3 } };
    expect(pickLeastUsed(usage, 'A', 3)).toBe(1);
  });
  it('remis → najniższy indeks', () => {
    const usage = { A: { 0: 0, 1: 0, 2: 4 } };
    expect(pickLeastUsed(usage, 'A', 3)).toBe(0);
  });
  it('wariant bez wpisu liczy się jako 0 użyć', () => {
    const usage = { A: { 0: 3 } };
    expect(pickLeastUsed(usage, 'A', 3)).toBe(1);
  });
});

describe('recordUsage', () => {
  it('zwraca nowy obiekt z inkrementem (immutability)', () => {
    const usage = { A: { 0: 1 } };
    const next = recordUsage(usage, 'A', 0);
    expect(next).not.toBe(usage);
    expect(next.A![0]).toBe(2);
    expect(usage.A![0]).toBe(1);
  });
});
