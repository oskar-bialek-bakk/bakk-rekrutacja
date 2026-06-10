import { app, InvocationContext, Timer } from '@azure/functions';

// Adres frontendu do rozgrzania (App Service). Nadpisywalny env-em, gdyby URL się zmienił.
const FRONTEND_URL = process.env.WARMUP_FRONTEND_URL ?? 'https://bakk-rekrutacja.azurewebsites.net/';

/**
 * Timer anty cold-start.
 *
 * Sedno: samo cykliczne odpalanie tego timera trzyma Function App (API) w cieple —
 * a to właśnie ten serwis łapał ~30 s zimnego startu (getSettings / variant-usage).
 * Przy okazji budzimy frontend (App Service), żeby index.html serwował się od razu
 * po zalogowaniu. Nie pingujemy Cosmosa, żeby nie generować RU bez potrzeby — rozgrzanie
 * hosta wystarcza, bo klient Cosmos to singleton modułowy i przeżywa między wywołaniami.
 *
 * Niezawodność: Azure (ScaleController) odpala timery punktualnie i budzi appkę, inaczej
 * niż GitHub cron, który potrafi się ślizgać o godziny.
 */
export async function warmup(_timer: Timer, ctx: InvocationContext): Promise<void> {
  try {
    // Twardy timeout, żeby przy problemie sieci/DNS request nie wisiał i nie trzymał
    // instancji funkcji (oraz nie nakładał się na kolejne odpalenia timera).
    const res = await fetch(FRONTEND_URL, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    ctx.log(`warmup: frontend ${FRONTEND_URL} -> HTTP ${res.status}`);
  } catch (err) {
    // Każdy kod (200/302/401) jest OK — chodzi o wybudzenie. Logujemy tylko realny błąd sieci.
    ctx.error(`warmup: ping frontendu nieudany: ${err instanceof Error ? err.message : String(err)}`);
  }
}

app.timer('warmup', {
  // NCRONTAB (UTC): {s} {m} {h} {dzień} {mies} {dzień-tyg}. Co 10 min, pon-pt, 6-15 UTC
  // (~08:00-17:50 PL latem / 07:00-16:50 zima — cron nie zna DST, stąd lekki margines).
  // Poza tym oknem cold start jest akceptowalny. 24/7: zmień na '0 */10 * * * *'.
  schedule: '0 */10 6-15 * * 1-5',
  handler: warmup,
});
