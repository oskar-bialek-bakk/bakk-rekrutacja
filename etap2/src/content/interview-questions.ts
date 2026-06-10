// Pytania wstępne (otwierające wywiad) i zamykające (przed negocjacjami).
// Nie wchodzą do punktacji bloków A-E — to kontekst i materiał do podsumowania
// dla rekrutera. Per pytanie: notatka tekstowa + sygnały do szybkiego odznaczenia
// (zielone = pozytywne, czerwone = ostrzegawcze).

export interface SignalOption {
  /** Klucz stabilny — pod nim trzymamy zaznaczenie w Assessment.signalChecks[questionId]. */
  id: string;
  /** Treść sygnału do odznaczenia. */
  text: string;
  /** Wydźwięk: pozytywny czy ostrzegawczy (red-flag). */
  tone: 'good' | 'bad';
}

export interface InterviewQuestion {
  /** Klucz stabilny — pod nim trzymamy notatkę w Assessment.intro / Assessment.closing. */
  id: string;
  /** Pełna treść pytania (czytana kandydatowi / prowadzącemu). */
  question: string;
  /** Krótka etykieta do podsumowania rekrutera / szczegółów. */
  short: string;
  /** Na co zwrócić uwagę (podpowiedź dla prowadzącego, składana). */
  hint?: string;
  /** Sugerowane sygnały do szybkiego odznaczenia (zielone/czerwone). */
  signals?: SignalOption[];
  /** Gdy true, przy pytaniu pokazujemy ogólne przyciski flagi czerwonej/zielonej. */
  flag?: boolean;
}

export const INTRO_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'kompetencje',
    short: 'Aktualne kompetencje',
    question:
      'Jak sam określiłbyś swoje aktualne kompetencje? Co już realnie potrafisz zrobić samodzielnie, a co jest na etapie „używałem, ale jeszcze się uczę”?',
    hint: 'Samoświadomość i uczciwość: czy rozróżnia „znam z teorii / kursu” od „robiłem to na realnym projekcie”. Zawyżanie lub zaniżanie to sygnał sam w sobie.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Rozróżnia „znam z kursu” od „robiłem na produkcji”' },
      { id: 'g2', tone: 'good', text: 'Realistycznie wskazuje swoje luki, wie czego nie umie' },
      { id: 'b1', tone: 'bad', text: 'Zawyża, deklaracje bez pokrycia' },
      { id: 'b2', tone: 'bad', text: 'Nie potrafi nazwać, co konkretnie potrafi' },
    ],
  },
  {
    id: 'kierunek',
    short: 'Kierunek rozwoju',
    question:
      'W którą stronę chciałbyś się rozwijać: bardziej w czysty development, w analizę, czy w koordynację i pracę z ludźmi? Co konkretnie cię w tym kierunku pociąga?',
    hint: 'Dopasowanie do realiów roli (utrzymanie + rozwój + kontakt z klientem). Szukamy konkretu, nie „wszystko po trochu”.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Konkretny kierunek, spójny z rolą (utrzymanie + rozwój + klient)' },
      { id: 'g2', tone: 'good', text: 'Potrafi powiedzieć DLACZEGO ten kierunek' },
      { id: 'b1', tone: 'bad', text: '„Wszystko po trochu”, brak preferencji' },
      { id: 'b2', tone: 'bad', text: 'Kierunek rozjeżdża się z tym, co oferujemy' },
    ],
  },
  {
    id: 'technologie',
    short: 'Najmocniejsze technologie',
    question:
      'W jakich technologiach czujesz się najmocniej? Co dokładnie cię w nich kręci, że akurat przy nich zostałeś?',
    hint: 'Głębia kontra lista haseł z CV. Dobre „dlaczego” (konkretny mechanizm, sposób myślenia) waży więcej niż długa lista.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Uzasadnia wybór konkretem (mechanizm, sposób myślenia)' },
      { id: 'g2', tone: 'good', text: 'Widać realną głębię, nie tylko hasła z CV' },
      { id: 'b1', tone: 'bad', text: 'Lista buzzwordów bez „dlaczego”' },
    ],
  },
  {
    id: 'samodzielna-nauka',
    short: 'Samodzielna nauka',
    question:
      'Czego nauczyłeś się całkowicie samodzielnie, poza studiami czy kursami? Jak do tego podszedłeś, od czego zacząłeś?',
    hint: 'Proaktywność i realny sposób uczenia się — predyktor radzenia sobie z nieznanym zadaniem.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Realny przebieg nauki (od czego zaczął, gdzie utknął, jak rozwiązał)' },
      { id: 'g2', tone: 'good', text: 'Uczy się sam, z własnej potrzeby' },
      { id: 'b1', tone: 'bad', text: 'Tylko to, co kazali na studiach / kursie' },
      { id: 'b2', tone: 'bad', text: 'Ogólniki („dużo czytam i ćwiczę”)' },
    ],
  },
  {
    id: 'ulubiony-projekt',
    short: 'Ulubiony projekt',
    question:
      'Opowiedz o projekcie, z którego jesteś najbardziej dumny albo który najbardziej cię wciągnął. Co konkretnie tam zrobiłeś i dlaczego akurat ten?',
    hint: 'Realny wkład („zrobiłem”) kontra „byłem w zespole, który”. Co go napędza: trudność, efekt, samodzielność.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Realny własny wkład („zrobiłem”), nie „byłem w zespole”' },
      { id: 'g2', tone: 'good', text: 'Potrafi opowiedzieć JAK, nie tylko CO' },
      { id: 'b1', tone: 'bad', text: 'Nie umie wskazać swojej roli w projekcie' },
    ],
  },
  {
    id: 'pracodawca-3',
    short: '3 elementy u pracodawcy',
    question:
      'Wymień 3 rzeczy, które są dla ciebie najważniejsze u pracodawcy. Dlaczego akurat te?',
    hint: 'Czy oczekiwania jesteśmy w stanie spełnić i czy wartości się pokrywają (zespół, rozwój, mentoring, stabilność, technologie, elastyczność).',
    signals: [
      { id: 'g1', tone: 'good', text: 'Konkretne wartości, które jesteśmy w stanie spełnić' },
      { id: 'g2', tone: 'good', text: 'Wartości pokrywają się z zespołem / rozwojem u nas' },
      { id: 'b1', tone: 'bad', text: 'Tylko pieniądze i przywileje' },
      { id: 'b2', tone: 'bad', text: 'Oczekiwania trudne do spełnienia u nas' },
    ],
  },
];

export const CLOSING_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'poprzednia-rozmowa',
    short: 'Skojarzenia z etapu I',
    question:
      'Czy po dzisiejszej rozmowie coś ci się skojarzyło albo wróciło z poprzedniego etapu, o co chciałbyś dopytać lub co chciałbyś jeszcze uzupełnić?',
    hint: 'Domknięcie pętli z etapu I. Czy słucha i łączy wątki, czy spójnie trzyma swoją historię między etapami.',
    signals: [
      { id: 'g1', tone: 'good', text: 'Ma realne pytania, łączy wątki z etapu I' },
      { id: 'g2', tone: 'good', text: 'Spójna historia między etapami' },
      { id: 'b1', tone: 'bad', text: 'Brak refleksji, nic nie wynosi z etapu I' },
      { id: 'b2', tone: 'bad', text: 'Niespójność z tym, co mówił wcześniej' },
    ],
  },
  {
    id: 'obecna-praca-usprawnienia',
    short: 'Usprawnienia w obecnej pracy',
    question:
      'Gdybyś mógł zmienić albo usprawnić jedną, dwie rzeczy w swojej obecnej (albo ostatniej) pracy, co by to było? Co byś zrobił inaczej?',
    hint: 'Nie chodzi o treść, tylko o sposób: konstruktywnie o procesach i rozwiązaniach, czy zsuwa się w narzekanie i obwinianie. Słuchaj, jak mówi o pracodawcy, zespole i klientach.',
    flag: true,
    signals: [
      { id: 'g1', tone: 'good', text: 'Konstruktywnie: proces + propozycja rozwiązania' },
      { id: 'g2', tone: 'good', text: 'Widzi też swoją rolę, nie tylko cudze winy' },
      { id: 'b1', tone: 'bad', text: 'Obwinia konkretne osoby / szefa zamiast procesów' },
      { id: 'b2', tone: 'bad', text: 'Oczernia pracodawcę, zdradza poufne szczegóły' },
      { id: 'b3', tone: 'bad', text: 'Same pretensje, zero własnej roli i propozycji' },
      { id: 'b4', tone: 'bad', text: '„Wszystko źle / beznadziejnie” bez konkretu' },
      { id: 'b5', tone: 'bad', text: 'Lekceważy współpracowników albo klientów' },
      { id: 'b6', tone: 'bad', text: 'Postawa roszczeniowa, wszystko sprowadza do pieniędzy' },
    ],
  },
];
