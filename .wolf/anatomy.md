# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-09-29T09:14:56.306Z
> Files: 139 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `_config.yml` — Etap I (index.html, eval.html) jest publiczny. Etap II i dokumentacja NIE są publikowane. (~48 tok)
- `.gitignore` — Git ignore rules (~43 tok)
- `.staticrypt.json` (~15 tok)
- `AGENTS.md` — OpenWolf (~75 tok)
- `CLAUDE.md` — OpenWolf (~99 tok)
- `eval.html` — BAKK · Klucz oceniający (~34178 tok)
- `index.html` — Zadanie rekrutacyjne SQL — BAKK (~6462 tok)

## .github/workflows/

- `deploy-bakk-rekrutacja-api.yml` — CI: Deploy etap2 API → bakk-rekrutacja-api (Function App) (~573 tok)
- `deploy-bakk-rekrutacja-etap2.yml` — CI: Deploy etap2 → bakk-rekrutacja (root) (~174 tok)
- `deploy-vite-to-azure.yml` — CI: Reusable — deploy Vite app to Azure App Service (~1119 tok)
- `etap2-ci.yml` — CI: etap2 CI (PR smoke) (~374 tok)

## docs/superpowers/plans/

- `2026-06-08-ocena-rozmowy-etap2.md` — Aplikacja oceny II etapu rozmowy — Implementation Plan (~22316 tok)
- `2026-06-09-traffit-wybor-kandydata.md` — Wybór kandydata z Traffit w „Nowej rozmowie" — plan implementacji (~13104 tok)

## docs/superpowers/specs/

- `2026-06-08-ocena-rozmowy-etap2-design.md` — Spec: Aplikacja do prowadzenia i oceny II etapu rozmowy rekrutacyjnej (~2944 tok)
- `2026-06-09-traffit-wybor-kandydata-design.md` — Wybór kandydata z Traffit w „Nowej rozmowie" (etap II) (~2237 tok)

## etap2/

- `.gitignore` — Git ignore rules (~86 tok)
- `index.html` — Ocena rozmowy — II etap · BAKK (~556 tok)
- `package.json` — Node.js package manifest (~164 tok)
- `playwright.config.ts` — Playwright test configuration (~74 tok)
- `README-deploy.md` — etap2 — deployment na Azure App Service (~3190 tok)
- `tsconfig.json` — TypeScript configuration (~156 tok)
- `vite.config.ts` — Vite build configuration (~76 tok)
- `vitest.config.ts` — Vitest test configuration (~92 tok)

## etap2/api/

- `.gitignore` — Git ignore rules (~16 tok)
- `host.json` (~87 tok)
- `local.settings.json.example` (~152 tok)
- `package.json` — Node.js package manifest (~233 tok)
- `tsconfig.json` — TypeScript configuration (~130 tok)
- `vitest.config.ts` — Vitest test configuration (~54 tok)

## etap2/api/src/functions/

- `assessments-delete.ts` — Exports assessmentsDelete (~281 tok)
- `assessments-get.ts` — API routes: GET (1 endpoints) (~430 tok)
- `assessments-list.ts` — API routes: GET (1 endpoints) (~393 tok)
- `assessments-upsert.ts` — Exports assessmentsUpsert (~681 tok)
- `health.ts` — Exports health (~493 tok)
- `settings-get.ts` — Exports settingsGet (~301 tok)
- `settings-put.ts` — Exports settingsPut (~330 tok)
- `traffit-candidates.ts` — Exports traffitCandidates (~438 tok)
- `traffit-push.ts` — Zod schemas: BodySchema (~787 tok)
- `variant-usage-get.ts` — Exports variantUsageGet (~522 tok)
- `variant-usage-increment.ts` — Exports variantUsageIncrement (~434 tok)
- `warmup.ts` — Timer anty cold-start. (~552 tok)

## etap2/api/src/lib/

- `auth.ts` — Reads identity from Easy Auth headers injected by Azure App Service / Function App (~824 tok)
- `cosmos.ts` — Lightweight ping for health endpoint - reads database metadata. (~412 tok)
- `http.ts` — Maps Cosmos SDK error codes to HTTP status. (~641 tok)
- `schemas.ts` — Assessment as stored in Cosmos: extends client shape with userPrincipalName partition key. (~1218 tok)
- `traffit-client.ts` — Traffit REST client z auto-loginem konta technicznego. (~3103 tok)
- `traffit-login.ts` — HTTP-based login flow do Traffit dla konta technicznego BAKK. (~1994 tok)

## etap2/api/tests/

- `assessments.test.ts` — CosmosItem: fakeReq, sampleAssessment (~2781 tok)
- `auth.test.ts` — Declares fakeReq (~812 tok)
- `traffit-candidates.test.ts` — listBkCandidates: fakeReq (~673 tok)
- `traffit-client.test.ts` — Mock traffit-login zeby uniknac realnego GET/POST do Traffit i zwracac stale cookie. (~1704 tok)
- `traffit-login.test.ts` — API routes: GET (3 endpoints) (~1495 tok)
- `traffit-push.test.ts` — CosmosItem: fakeReq (~1210 tok)
- `usage-settings.test.ts` — StoreDoc: fakeReq (~2411 tok)

## etap2/public/

- `web.config` (~169 tok)

## etap2/scripts/

- `configure-function-app-auth.ps1` — Konfiguracja Easy Auth (Microsoft Entra) + CORS na Function App `bakk-rekrutacja-api`. (~1790 tok)
- `enable-easy-auth.ps1` — Włącza Easy Auth (Microsoft Entra) na App Service `bakk-rekrutacja`. (~1394 tok)
- `provision-cosmos.ps1` — Provisioning Cosmos DB serverless dla etap2 (Faza 5). (~1661 tok)
- `provision-function-app.ps1` — Provisioning Function App `bakk-rekrutacja-api` (Faza 5 Task 2). (~1517 tok)
- `set-traffit-secrets.ps1` — Konfiguracja sekretow Traffit dla Function App `bakk-rekrutacja-api`. (~822 tok)

## etap2/src/

- `app.ts` — Exports navigate, openDetail, render (~523 tok)
- `env.d.ts` — / <reference types="vite/client" /> (~64 tok)
- `main.ts` — Najpierw maluj UI z defaultowymi ustawieniami, POTEM dociągaj ustawienia w tle. (~616 tok)
- `state.ts` — Czy backend (Azure) jest aktywny — bramka funkcji Traffit (lista + push). (~398 tok)

## etap2/src/auth/

- `access-token.ts` — Exports REDIRECTING_TO_LOGIN, isRedirectingToLogin, getAccessToken, forceRefresh (~1051 tok)

## etap2/src/content/

- `blocks.ts` — Poprawne wyniki/odpowiedzi per wariant (równolegle do variants[]). Opcjonalne. (~4322 tok)
- `interview-questions.ts` — Klucz stabilny — pod nim trzymamy zaznaczenie w Assessment.signalChecks[questionId]. (~2134 tok)

## etap2/src/domain/

- `block-state.ts` — Exports BlockState, blockState (~282 tok)
- `completeness.ts` — Zwraca aktywne bloki (w kolejności wejścia), które nie mają notatki (~121 tok)
- `escape.ts` — Exports escapeHtml (~80 tok)
- `model.ts` — Odpowiedzi na pytania wstępne / zamykające — keyed po `id` pytania (poza punktacją). (~893 tok)
- `recruiter-summary.ts` — Exports RecruiterSummary, buildRecruiterSummary (~2282 tok)
- `roster.ts` — Exports SortKey, SortDir, DecisionFilter, RosterEntry + 2 more (~405 tok)
- `scoring.ts` — Exports ScoreResult, computeScore (~323 tok)
- `settings.ts` — Laduje ustawienia z repo, scalajac z defaultami (defensive merge). (~328 tok)
- `timer.ts` — Parsuje string typu "5 min", "10 min", "30 s", "1 h" do liczby sekund. (~938 tok)
- `traffit-roster.ts` — Ukrywa pary (traffitId, recruitmentId) już obecne w rosterze; sortuje po employeeId rosnąco. (~532 tok)
- `variants.ts` — Exports pickLeastUsed, recordUsage, recordSelectedVariants (~303 tok)
- `weights.config.ts` — Jedyne źródło prawdy dla wag. W Fazie 3 nadpisywalne w ekranie ustawień. (~57 tok)

## etap2/src/export/

- `csv.ts` — Exports RosterRow, rosterToCsv (~492 tok)
- `json.ts` — Exports serializeAssessment, serializeAll, parseImport (~388 tok)

## etap2/src/persistence/

- `azure-store.ts` — Imports localStorage data into Cloud (Task 7 migration UI). (~2060 tok)
- `crash-guard.ts` — Spina draft (localStorage) z cyklem życia aplikacji: (~828 tok)
- `draft.ts` — Siatka bezpieczeństwa przed utratą wypełnianej oceny. Trzyma JEDNĄ ocenę (~619 tok)
- `local-snapshot.ts` — Exports LocalSnapshot, readLocalSnapshot, clearLocalSnapshot (~580 tok)
- `local-store.ts` — Exports LocalStore (~543 tok)
- `migrations.ts` — Exports migrateAssessment (~1348 tok)
- `repository.ts` — Exports Repository (~132 tok)
- `traffit-api.ts` — API routes: GET (1 endpoints) (~482 tok)
- `traffit-candidates.ts` — API routes: GET (1 endpoints) (~425 tok)

## etap2/src/ui/

- `confirm-dialog.ts` — Wewnątrzaplikacyjny dialog potwierdzenia zastępujący window.confirm. (~1065 tok)
- `copy.ts` — Exports htmlToPlain, copyToClipboard (~320 tok)
- `download.ts` — Exports downloadTextFile, safeFilenamePart (~178 tok)
- `escape.ts` (~14 tok)
- `migration-banner.ts` — Wywolane po udanym imporcie - typowo navigate('roster') zeby user widzial przeniesione rozmowy. (~1130 tok)
- `qna.ts` — Edytowalna karta jednego pytania (ekran intro + podsumowanie). (~1823 tok)
- `recruiter-preview-dialog.ts` — Exports openRecruiterPreview (~3068 tok)
- `screen-assess.ts` — Exports effectiveBlock, activeBlocks, renderAssess (~4124 tok)
- `screen-detail.ts` — Exports renderDetail (~2928 tok)
- `screen-intro.ts` — Ekran „Wywiad otwierający" — pytania wstępne zadawane na początku rozmowy. (~772 tok)
- `screen-roster.ts` — Exports renderRoster (~2776 tok)
- `screen-settings.ts` — Exports renderSettings (~1686 tok)
- `screen-start.ts` — Exports renderStart (~2563 tok)
- `screen-summary.ts` — Exports renderSummary (~2412 tok)
- `theme.css` — Styles: 17 vars, 2 animations (~13096 tok)
- `timer-ui.ts` — Dolewa deltaSec do bloku aktywnego (session.cur w activeBlocks). (~2044 tok)

## etap2/tests/

- `azure-store.test.ts` — API routes: DELETE (2 endpoints) (~1750 tok)
- `block-state.test.ts` — Declares fresh (~929 tok)
- `blocks.test.ts` — Declares w (~492 tok)
- `completeness.test.ts` — Declares active (~509 tok)
- `copy.test.ts` — Declares html (~328 tok)
- `crash-guard.test.ts` — Declares newAssessment (~346 tok)
- `draft.test.ts` — AssessmentDraft: sample (~933 tok)
- `escape.test.ts` (~260 tok)
- `export-csv.test.ts` — BOM: row, stripBom, lines (~1658 tok)
- `export-json.test.ts` — Declares sample (~1083 tok)
- `local-snapshot.test.ts` — Declares MemoryStorage (~778 tok)
- `local-store.test.ts` — API routes: GET, DELETE (3 endpoints) (~466 tok)
- `migration-banner.test.ts` — MemStorage: seed (~1128 tok)
- `migrations.test.ts` — Declares raw (~1003 tok)
- `model.test.ts` — Declares a (~441 tok)
- `recruiter-preview-dialog.test.ts` — settings: makeAssessment (~1162 tok)
- `recruiter-preview-traffit.test.ts` — h: settings, makeAssessment (~1350 tok)
- `recruiter-summary.test.ts` — settings: baseAssessment (~1625 tok)
- `roster.test.ts` — RosterEntry: entry (~1371 tok)
- `scoring.test.ts` — Declares r (~472 tok)
- `screen-assess.test.ts` — setShowLive: mount (~1700 tok)
- `screen-settings.test.ts` — K_SETTINGS: mount, setWeights (~1536 tok)
- `screen-start.test.ts` — h: flush (~1501 tok)
- `screen-summary.test.ts` — K_SETTINGS: setupAssessment, mount (~632 tok)
- `settings.test.ts` — Declares makeRepo (~630 tok)
- `state.test.ts` — Declares stored (~268 tok)
- `timer-ui.test.ts` — Declares setupAnnouncementDom (~1700 tok)
- `timer.test.ts` — Declares next (~1368 tok)
- `traffit-candidates.test.ts` — fetchMock: ok (~418 tok)
- `traffit-roster.test.ts` — Declares TraffitCandidate (~492 tok)
- `variants.test.ts` — Declares usage (~661 tok)
- `weights.test.ts` (~105 tok)

## etap2/tests/e2e/

- `flow.spec.ts` — Declares previewDialog (~1101 tok)
