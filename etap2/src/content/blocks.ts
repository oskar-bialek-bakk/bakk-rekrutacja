import type { BlockId } from '../domain/model';

export interface Variant { label: string; read: string; }
export interface Block {
  id: BlockId;
  key: string;
  title: string;
  time: string;
  weight: number;
  optional?: boolean;
  variants: Variant[];
  deepen: string;
  keyTitle: string;
  keys: string[];
  /** Poprawne wyniki/odpowiedzi per wariant (równolegle do variants[]). Opcjonalne. */
  variantAnswers?: string[];
  /** Pula pytań do oznaczania „zadano" (np. blok D). Opcjonalne. */
  questions?: string[];
  flagRed: string;
  flagGreen: string;
  scale: string[];
}

export const BLOCKS: Block[] = [
  {
    id: 'A', key: 'Blok A · rozgrzewka', title: 'Śledzenie algorytmu', time: '5 min', weight: 15,
    variants: [
      { label: 'A-1 · max + parzyste', read: `<p>Trzymamy <span class="mono">wynik</span> = pierwszy element. Dla każdego kolejnego: jeśli <b>większy</b> od <span class="mono">wynik</span> → ustaw <span class="mono">wynik</span> na niego. Jeśli element jest <b>parzysty</b> → zwiększ <span class="mono">parzyste</span> o 1. Zwróć <span class="mono">(wynik, parzyste)</span>.</p><p>Wejście: <span class="mono">[3, 8, 2, 8, 5, 10, 1]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (10, 4)</i></p>` },
      { label: 'A-2 · min + podz. przez 3', read: `<p>Trzymamy <span class="mono">wynik</span> = pierwszy element. Dla każdego kolejnego: jeśli <b>mniejszy</b> od <span class="mono">wynik</span> → ustaw <span class="mono">wynik</span> na niego. Jeśli element jest <b>podzielny przez 3</b> → zwiększ <span class="mono">licznik</span> o 1. Zwróć <span class="mono">(wynik, licznik)</span>.</p><p>Wejście: <span class="mono">[7, 9, 4, 3, 9, 1, 6]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (1, 4)</i></p>` },
      { label: 'A-3 · suma długości + inicjały', read: `<p>Trzymamy <span class="mono">suma</span> = 0, <span class="mono">wynik</span> = "". Dla każdego słowa: dodaj jego długość do <span class="mono">suma</span>; jeśli zaczyna się na samogłoskę → doklej pierwszą literę do <span class="mono">wynik</span>. Zwróć <span class="mono">(suma, wynik)</span>.</p><p>Wejście: <span class="mono">["okno","dom","ul","kot","auto"]</span> → ? &nbsp;<i style="color:var(--ink-faint)">popr. (16, "oua")</i></p>` },
    ],
    deepen: 'Co się zmieni, jeśli usuniemy ostatni element? A jeśli lista będzie pusta — co powinien zrobić algorytm?',
    keyTitle: 'Klucz — śledzenie krok po kroku',
    keys: ['Czy śledzi krok po kroku, czy zgaduje', 'Czy łapie niezależność warunków', 'Pułapka: pominięte powtórzenie → zaniżony licznik (częsty błąd: 3 zamiast 4)', 'Jeśli poda od razu wynik — poproś o myślenie na głos'],
    variantAnswers: ['(wynik = 10, parzyste = 4)', '(wynik = 1, licznik = 4)', '(suma = 16, wynik = "oua")'],
    flagRed: 'Zgaduje, myli logikę warunków', flagGreen: 'Sam weryfikuje, przelicza drugi raz',
    scale: [
      'Zgaduje, nie potrafi prześledzić nawet po naprowadzeniu; myli logikę warunków.',
      'Próbuje śledzić, ale gubi się; błędny wynik i proces, lub wymaga prowadzenia na każdym kroku.',
      'Wynik z drobnym błędem (pominięte powtórzenie), ale proces poprawny i samodzielny.',
      'Poprawny wynik i uporządkowany proces; po naprowadzeniu od razu łapie pomyłkę.',
      'Poprawny wynik samodzielnie, śledzi czysto na głos, sam weryfikuje, rozróżnia niezależność warunków.',
    ],
  },
  {
    id: 'B', key: 'Blok B · scenariusz', title: 'Objaw vs. przyczyna', time: '9–10 min', weight: 30,
    variants: [
      { label: 'B-1 · padający dysk', read: `<p>Padł system produkcyjny. Osoba zwiększyła dysk ze <span class="mono">100 GB</span> na <span class="mono">150 GB</span>, restart — zadziałało. Wcześniej przez pół roku 100 GB w pełni wystarczało i miejsce <b>nie</b> przyrastało.</p><p>Po dwóch tygodniach dysk znów się zapełnił. Co o tym myślisz? Co byś zrobił?</p>` },
      { label: 'B-2 · nocny restart', read: `<p>Aplikacja co kilka dni „zawiesza się” na kilka minut, potem wraca sama. Ktoś ustawił automatyczny restart serwisu co noc — problem „zniknął”.</p><p>Po dwóch tygodniach zawieszenia wróciły, mimo restartów. Co o tym myślisz?</p>` },
      { label: 'B-3 · timeout na SQL', read: `<p>Zapytanie, które zawsze działało w ułamku sekundy, czasami trwa kilkadziesiąt sekund. Ktoś dołożył timeout, żeby aplikacja „nie wisiała”.</p><p>Problem zgłaszany dalej. Co robisz?</p>` },
    ],
    deepen: 'Załóżmy, że znalazłeś przyczynę. Jak byś się upewnił, że to się nie powtórzy bez niczyjej interwencji?',
    keyTitle: 'Klucz — objaw vs. przyczyna',
    keys: ['Czy widzi, że „szybka naprawa” to leczenie objawu', 'Hipotezy o przyczynie (wyciek zasobu, logi, dane, brak indeksu…)', 'Diagnostyka PRZED działaniem: co i jak szybko rośnie/zwalnia, od kiedy', 'Pyta co się zmieniło wcześniej'],
    flagRed: '„Powtórzę tę samą szybką naprawę” jako jedyna myśl', flagGreen: 'Chce zmierzyć / zrozumieć zanim zadziała',
    scale: [
      'Proponuje tylko powtórzyć obejście; nie widzi, że to objaw.',
      'Czuje, że „coś nie tak”, ale nie nazywa kierunku diagnozy; chaotyczny.',
      'Rozpoznaje objaw vs. przyczyna, 1–2 sensowne hipotezy, słabo planuje diagnostykę.',
      'Jasno oddziela objaw od przyczyny, trafne hipotezy, chce sprawdzić co i jak szybko narasta.',
      'Jak 4 + pyta co się zmieniło wcześniej, porządkuje diagnozę w kroki, myśli o monitoringu.',
    ],
  },
  {
    id: 'C', key: 'Blok C · scenariusz', title: 'Postawa pod presją', time: '9–10 min', weight: 25,
    variants: [
      { label: 'C-1 · klient: nie działa SMS', read: `<p>Dzwoni klient. Nie działa wysyłka SMS-ów i „przez to stoi cała firma”. Podaje numer zgłoszenia, jest poirytowany — twierdzi, że nikt się tym nie zajął od 15 minut.</p><p>Odbierasz ten telefon. Co robisz?</p>` },
      { label: 'C-2 · złe liczby w raporcie', read: `<p>Klient pisze, że po wczorajszej aktualizacji raporty pokazują „złe liczby” — i właśnie wysłał je do swojego zarządu. Jest spanikowany, żąda natychmiastowego wycofania zmiany.</p><p>Co robisz?</p>` },
      { label: 'C-3 · „skrajnie wolno”', read: `<p>Dzwoni klient, że „system jest skrajnie wolny i nie da się pracować”, grozi eskalacją do twojego szefa. Z twojej strony monitoring nic nie pokazuje.</p><p>Co robisz?</p>` },
    ],
    deepen: 'A gdyby się okazało, że to nie nasza wina, tylko ich łącze / konfiguracja — jak byś to zakomunikował, nie psując relacji?',
    keyTitle: 'Klucz — presja, priorytet, komunikacja',
    keys: ['Czy najpierw opanowuje rozmowę i przejmuje sprawę', 'Czy priorytetyzuje adekwatnie do skutku', 'Czy zbiera konkrety: od kiedy, co dokładnie, co się zmieniło', 'Czy komunikuje następne kroki i czas; wie kiedy eskalować'],
    flagRed: 'Kłótnia / zrzucanie winy / obietnice bez pokrycia', flagGreen: 'Empatia + konkret + jasne następne kroki',
    scale: [
      'Reaguje obronnie / kłótliwie / panikuje; nie przejmuje kontroli.',
      'Dobre chęci, ale chaos; nadmierne przepraszanie lub obietnice bez pokrycia.',
      'Opanowany, zbiera podstawy, rozumie priorytet, ale brak jasnej komunikacji kroków/czasu.',
      'Opanowany, priorytetyzuje, zbiera konkrety, komunikuje kroki; wie kiedy eskalować.',
      'Jak 4 + łączy empatię z konkretem, zarządza oczekiwaniami co do czasu, świadomy granic kompetencji.',
    ],
  },
  {
    id: 'D', key: 'Blok D · postawa', title: 'Motywacja i dopasowanie', time: '8 min', weight: 30,
    variants: [
      { label: 'Pula pytań (wybierz 3–4)', read: `<p>Wybierz 3–4 z puli:</p><p>1. Czemu programowanie i czemu .NET/SQL? Co cię w tym trzyma?<br>2. Czemu nasza firma / ten typ pracy (utrzymanie + rozwój, praca z klientem)?<br>3. Opowiedz o krytycznym feedbacku do twojego kodu — jak zareagowałeś?<br>4. Czego chcesz się nauczyć w pierwszym roku? Jak się uczysz?<br>5. Coś technicznego, czego nie umiałeś, a musiałeś ogarnąć — jak podszedłeś?</p>` },
    ],
    deepen: 'Gdybyś za pół roku dostał zadanie kompletnie poza twoją obecną wiedzą — co robisz w pierwszej kolejności?',
    keyTitle: 'Klucz — feedback i ciekawość',
    keys: ['Motywacja własna i konkretna vs. ogólniki', 'Feedback: bierze poprawkę czy usztywnia się (predyktor code review)', 'Realny sposób nauki vs. deklaracje', 'Rozumie realia roli (utrzymanie, klient), nie tylko greenfield'],
    questions: [
      'Czemu programowanie i czemu .NET/SQL? Co cię w tym trzyma?',
      'Czemu nasza firma / ten typ pracy (utrzymanie + rozwój, praca z klientem)?',
      'Opowiedz o krytycznym feedbacku do twojego kodu — jak zareagowałeś?',
      'Czego chcesz się nauczyć w pierwszym roku? Jak się uczysz?',
      'Coś technicznego, czego nie umiałeś, a musiałeś ogarnąć — jak podszedłeś?',
    ],
    flagRed: 'Obwinia innych za feedback; brak ciekawości', flagGreen: 'Konkretny przykład wzięcia poprawki + ciekawość',
    scale: [
      'Ogólniki, brak własnej motywacji; do feedbacku obronny/lekceważący.',
      'Powierzchowna motywacja; feedback toleruje bez refleksji; nauka deklaratywna.',
      'Sensowna motywacja, akceptuje feedback, jakiś sposób nauki, ale bez mocnego przykładu.',
      'Konkretna motywacja, dobry przykład wzięcia feedbacku, realny sposób uczenia się.',
      'Jak 4 + wyraźna wewnętrzna ciekawość, dojrzałe rozumienie realiów roli, feedback jak paliwo.',
    ],
  },
  {
    id: 'E', key: 'Blok E · zapas (bez wagi)', title: 'Projekt: podlewanie', time: 'jeśli zostanie czas', weight: 0, optional: true,
    variants: [
      { label: 'E · układ podlewania', read: `<p><b>Kontekst:</b> to uproszczony projekt systemu z gotowych klocków — interesuje nas <i>struktura</i> rozwiązania, nie hydraulika. Nie potrzebujesz wiedzy o ogrodnictwie.</p><p><b>Zadanie:</b> zaprojektuj układ podlewania dla 8 doniczek. Opisz słownie albo naszkicuj.</p><p><b>Dostępne elementy:</b></p><ul><li><span class="mono">rura</span> — pojedyncza magistrala doprowadzająca wodę ze źródła</li><li><span class="mono">trójniki</span> — rozgałęziają rurę (1 wejście → 2 wyjścia)</li><li><span class="mono">emitery</span> — dozują wodę do pojedynczej doniczki (po jednym na doniczkę)</li></ul>` },
    ],
    deepen: 'A gdyby doniczek było 50 i stały w dwóch rzędach — co zmieniłbyś w podejściu?',
    keyTitle: 'Klucz — projektowanie z klocków (jakościowo, bez punktów do wyniku)',
    keys: ['Struktura: magistrala + rozgałęzienia trójnikami + emiter na gałęzi', 'Kompletność: każda doniczka obsłużona', 'Prostota rozwiązania', 'To notatka jakościowa — NIE wlicza się do wyniku'],
    flagRed: 'Chaotycznie, gubi doniczki', flagGreen: 'Czysta, skalowalna struktura',
    scale: [
      'Brak struktury, nie ogarnia połączeń.',
      'Częściowe, gubi część doniczek lub logikę rozgałęzień.',
      'Działający układ, ale nieelegancki.',
      'Czysty układ: magistrala + trójniki + emitery, wszystkie doniczki.',
      'Jak 4 + myśli o skalowaniu / prostocie / równym ciśnieniu.',
    ],
  },
];
