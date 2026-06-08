import { AzureStore } from '../persistence/azure-store';
import type { Repository } from '../persistence/repository';
import { clearLocalSnapshot, readLocalSnapshot } from '../persistence/local-snapshot';

export interface MigrationDeps {
  repo: Repository;
  reload: () => void | Promise<void>;
  storage?: { getItem(k: string): string | null; removeItem(k: string): void };
  confirmFn?: (msg: string) => boolean;
}

/**
 * Renders the localStorage -> Azure migration banner into `host` if all of:
 * - repo instanceof AzureStore (only meaningful in cloud mode)
 * - localStorage has any of: assessments / variantUsage / settings keys with data
 *
 * Returns true when the banner was rendered. Returns false otherwise (host left untouched).
 */
export function renderMigrationBanner(host: HTMLElement, deps: MigrationDeps): boolean {
  if (!(deps.repo instanceof AzureStore)) return false;
  const snapshot = readLocalSnapshot(deps.storage);
  if (!snapshot) return false;

  const { counts } = snapshot;
  host.innerHTML = `
    <div class="migration-banner" role="status">
      <div class="migration-banner__text">
        <strong>Wykryliśmy dane z tego urządzenia.</strong>
        <span>${counts.assessments} ${counts.assessments === 1 ? 'rozmowa' : 'rozmów'}, ${counts.variantUsage} przypisań wariantów${counts.settings ? ', ustawienia' : ''}.</span>
      </div>
      <button type="button" class="btn primary" id="btn-migrate">Zaimportuj do chmury</button>
      <span class="migration-banner__status" id="migration-status" aria-live="polite"></span>
    </div>`;

  const btn = host.querySelector('#btn-migrate') as HTMLButtonElement;
  const statusEl = host.querySelector('#migration-status') as HTMLElement;
  const confirmFn = deps.confirmFn ?? ((msg) => window.confirm(msg));

  btn.onclick = async () => {
    btn.disabled = true;
    statusEl.textContent = 'Wysyłam dane do chmury…';
    try {
      const result = await (deps.repo as AzureStore).importBulk({
        assessments: snapshot.assessments,
        settings: snapshot.settings,
        variantUsage: snapshot.variantUsage,
      });
      statusEl.textContent = `Zaimportowano ${result.assessments} rozmów i ${result.variantUsageIncrements} przypisań.`;

      if (confirmFn('Dane przeniesione. Usunąć kopię z tego urządzenia (zalecane)?')) {
        clearLocalSnapshot(deps.storage);
        host.innerHTML = '';
      } else {
        btn.disabled = true;
      }
      await deps.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd';
      statusEl.textContent = `Błąd importu: ${msg}. Dane lokalne zostają.`;
      btn.disabled = false;
    }
  };

  return true;
}
