import { Container, CosmosClient, Database } from '@azure/cosmos';

let clientSingleton: CosmosClient | null = null;
let dbSingleton: Database | null = null;

function getClient(): CosmosClient {
  if (clientSingleton) return clientSingleton;
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    throw new Error('Missing COSMOS_ENDPOINT or COSMOS_KEY in app settings');
  }
  clientSingleton = new CosmosClient({ endpoint, key });
  return clientSingleton;
}

function getDatabase(): Database {
  if (dbSingleton) return dbSingleton;
  const dbName = process.env.COSMOS_DB ?? 'etap2';
  dbSingleton = getClient().database(dbName);
  return dbSingleton;
}

export function assessmentsContainer(): Container {
  return getDatabase().container('assessments');
}

export function variantUsageContainer(): Container {
  return getDatabase().container('variantUsage');
}

export function settingsContainer(): Container {
  return getDatabase().container('settings');
}

/**
 * Lightweight ping for health endpoint - reads database metadata.
 * Throws on connection / auth failure, lets caller catch and report.
 */
export async function pingCosmos(): Promise<void> {
  await getDatabase().read();
}

/** Reset singletons (used in tests). */
export function _resetCosmosClient(): void {
  clientSingleton = null;
  dbSingleton = null;
}
