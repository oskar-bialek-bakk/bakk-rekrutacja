// Pytania wstępne (otwierające wywiad) i zamykające (przed negocjacjami).
// Nie wchodzą do punktacji bloków A-E — to kontekst i materiał do podsumowania
// dla rekrutera. Odpowiedzi zapisujemy jako notatki keyed po `id` pytania.

export interface InterviewQuestion {
  /** Klucz stabilny — pod nim trzymamy notatkę w Assessment.intro / Assessment.closing. */
  id: string;
  /** Pełna treść pytania (czytana kandydatowi / prowadzącemu). */
  question: string;
  /** Krótka etykieta do podsumowania rekrutera. */
  short: string;
  /** Na co zwrócić uwagę przy odpowiedzi (podpowiedź dla prowadzącego). */
  hint?: string;
  /** Gdy true, przy pytaniu pokazujemy przyciski flagi czerwonej/zielonej. */
  flag?: boolean;
  /** Sygnały ostrzegawcze do obserwacji (pokazywane pod pytaniem, składane). */
  redFlags?: string[];
}

export const INTRO_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'kompetencje',
    short: 'Aktualne kompetencje',
    question:
      'Jak sam określiłbyś swoje aktualne kompetencje? Co już realnie potrafisz zrobić samodzielnie, a co jest na etapie „używałem, ale jeszcze się uczę”?',
    hint: 'Samoświadomość i uczciwość: czy rozróżnia „znam z teorii / kursu” od „robiłem to na realnym projekcie”. Zawyżanie lub zaniżanie jest sygnałem samo w sobie.',
  },
  {
    id: 'kierunek',
    short: 'Kierunek rozwoju',
    question:
      'W którą stronę chciałbyś się rozwijać: bardziej w czysty development, w analizę, czy w koordynację i pracę z ludźmi? Co konkretnie cię w tym kierunku pociąga?',
    hint: 'Dopasowanie do realiów roli (utrzymanie + rozwój + kontakt z klientem). Szukamy konkretu, nie „wszystko po trochu”. Czy kierunek pokrywa się z tym, co oferujemy.',
  },
  {
    id: 'technologie',
    short: 'Najmocniejsze technologie',
    question:
      'W jakich technologiach czujesz się najmocniej? Co dokładnie cię w nich kręci, że akurat przy nich zostałeś?',
    hint: 'Głębia kontra lista haseł z CV. Dobre „dlaczego” (np. konkretny mechanizm, sposób myślenia) waży więcej niż długa lista. Czy potrafi uzasadnić wybór.',
  },
  {
    id: 'samodzielna-nauka',
    short: 'Samodzielna nauka',
    question:
      'Czego nauczyłeś się całkowicie samodzielnie, poza studiami czy kursami? Jak do tego podszedłeś, od czego zacząłeś?',
    hint: 'Proaktywność i realny sposób uczenia się. To predyktor radzenia sobie z nowym, nieznanym zadaniem. Konkretny przebieg („zacząłem od X, utknąłem na Y, zrobiłem Z”) kontra ogólniki.',
  },
  {
    id: 'ulubiony-projekt',
    short: 'Ulubiony projekt',
    question:
      'Opowiedz o projekcie, z którego jesteś najbardziej dumny albo który najbardziej cię wciągnął. Co konkretnie tam zrobiłeś i dlaczego akurat ten?',
    hint: 'Realny wkład („zrobiłem”) kontra „byłem w zespole, który”. Co go napędza: trudność techniczna, efekt dla użytkownika, samodzielność. Słuchaj, czy potrafi opowiedzieć „jak”, nie tylko „co”.',
  },
  {
    id: 'pracodawca-3',
    short: '3 elementy u pracodawcy',
    question:
      'Wymień 3 rzeczy, które są dla ciebie najważniejsze u pracodawcy. Dlaczego akurat te?',
    hint: 'Czy oczekiwania jesteśmy w stanie spełnić i czy wartości się pokrywają (zespół, rozwój, mentoring, stabilność, technologie, elastyczność). Konkrety, a nie tylko „dobra atmosfera i pieniądze”.',
  },
];

export const CLOSING_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'poprzednia-rozmowa',
    short: 'Skojarzenia z etapu I',
    question:
      'Czy po dzisiejszej rozmowie coś ci się skojarzyło albo wróciło z poprzedniego etapu, o co chciałbyś dopytać lub co chciałbyś jeszcze uzupełnić?',
    hint: 'Domknięcie pętli z etapu I. Czy słucha i łączy wątki, czy ma realne pytania, czy spójnie trzyma swoją historię między etapami.',
  },
  {
    id: 'obecna-praca-usprawnienia',
    short: 'Usprawnienia w obecnej pracy',
    question:
      'Gdybyś mógł zmienić albo usprawnić jedną, dwie rzeczy w swojej obecnej (albo ostatniej) pracy, co by to było? Co byś zrobił inaczej?',
    hint: 'Nie chodzi o samą treść, tylko o sposób: czy mówi konstruktywnie o procesach i rozwiązaniach, czy zsuwa się w narzekanie i obwinianie. Słuchaj, jak mówi o obecnym pracodawcy, zespole i klientach.',
    flag: true,
    redFlags: [
      'Obwinia konkretne osoby albo szefa zamiast mówić o procesach i rozwiązaniach.',
      'Oczernia obecnego/byłego pracodawcę, zdradza poufne szczegóły lub wewnętrzne konflikty.',
      'Same pretensje, zero własnej roli i zero propozycji, jak by to naprawił.',
      'Generalne „wszystko jest źle / beznadziejnie” bez konkretu i bez przykładu.',
      'Lekceważący ton wobec współpracowników, juniorów albo klientów.',
      'Postawa roszczeniowa („mnie się należało”, „to nie moja sprawa”) bez wzajemności.',
      'Przeskakuje na pieniądze/przywileje jako jedyny powód, dla którego „coś jest nie tak”.',
    ],
  },
];
