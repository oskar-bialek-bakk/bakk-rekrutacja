import { describe, it, expect } from 'vitest';
import { pickLeastUsed, recordUsage, recordSelectedVariants } from '../src/domain/variants';

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

describe('recordSelectedVariants', () => {
  it('inkrementuje wybrany wariant dla każdego bloku rotującego', () => {
    const next = recordSelectedVariants({}, { A: 1, B: 0, C: 2 }, ['A', 'B', 'C']);
    expect(next.A![1]).toBe(1);
    expect(next.B![0]).toBe(1);
    expect(next.C![2]).toBe(1);
  });

  it('akumuluje na istniejącym liczniku', () => {
    const usage = { A: { 1: 3 } };
    const next = recordSelectedVariants(usage, { A: 1 }, ['A', 'B', 'C']);
    expect(next.A![1]).toBe(4);
  });

  it('ignoruje bloki spoza listy rotujących', () => {
    const next = recordSelectedVariants({}, { A: 0, D: 0, E: 0 }, ['A', 'B', 'C']);
    expect(next.A![0]).toBe(1);
    expect(next.D).toBeUndefined();
    expect(next.E).toBeUndefined();
  });

  it('pomija bloki rotujące nieobecne w selectedVariants', () => {
    const next = recordSelectedVariants({}, { A: 0 }, ['A', 'B', 'C']);
    expect(next.A![0]).toBe(1);
    expect(next.B).toBeUndefined();
    expect(next.C).toBeUndefined();
  });

  it('nie mutuje wejściowego obiektu usage', () => {
    const usage = { A: { 1: 3 } };
    const next = recordSelectedVariants(usage, { A: 1 }, ['A', 'B', 'C']);
    expect(next).not.toBe(usage);
    expect(usage.A![1]).toBe(3);
  });
});
