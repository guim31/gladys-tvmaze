# TVmaze

Die nächsten Folgen deiner Serien in Gladys, nach [TVmaze](https://www.tvmaze.com), einem kostenlosen
TV-Guide: ein Kalender pro Person, ein Dashboard-Widget und Szenenauslöser. Kein Konto, kein
API-Schlüssel.

Diese Integration ist nicht mit TVmaze verbunden. Getestet wurde sie gegen die echte TVmaze-API und das
Test-Double von Gladys getestet, noch nicht auf einer echten Gladys-Instanz: Rückmeldungen sind im
Forum oder auf GitHub willkommen.

## Was du bekommst

- **Ein Kalender „Serien“ pro Person** im Gladys-Kalender: jede Folge der Serien, die du verfolgst,
  von zwei Wochen zurück bis ein Jahr voraus, mit Staffel und Folgennummer (S02E10), Titel, Sender
  oder Plattform (FOX, Apple TV, Netflix…) als Ort und Zusammenfassung. Eine Folge mit Sendezeit
  dauert ihre Laufzeit; eine Folge ohne Uhrzeit (meist Streaming) ist ein ganztägiger Termin.
- **Ein Dashboard-Widget**, „Nächste Folgen“: die kommenden Folgen, dann der Stand jeder Serie
  (nächste Folge in 3 Tagen, beendet, läuft ohne Termin).
- **Zwei Szenenauslöser**: eine Folge einer verfolgten Serie läuft heute (morgens oder zur
  Sendezeit), und eine neue Folge wird für eine Serie angekündigt, die keine mehr hatte.
- **Eine Szenenaktion**, „Nächste Folge lesen“: die nächste Folge einer Serie, die verbleibenden Tage
  und der Status der Serie.

Die Kalenderansicht, der Dashboard-Kalender und der eingebaute Auslöser „Ein Kalendertermin steht
bevor“ von Gladys funktionieren mit diesen Kalendern ebenfalls, sobald sie geteilt sind.

## Konfiguration

**Jede Person** aktiviert die Integration auf ihrer Seite unter „Meine Kalender“ und listet die
verfolgten Serien in **Verfolgte Serien** auf, durch Kommas getrennt:

- ein **Titel**: `Severance`, `The Simpsons`. Der beste Treffer von TVmaze wird genommen;
- eine **TVmaze-ID**: `#526` (oder `526`);
- eine **TVmaze-Adresse**: `https://www.tvmaze.com/shows/526/the-office`.

Die Beschreibung deines Kalenders nennt die Serie, die jeder Titel gefunden hat (Jahr, Sender, ID),
die Titel, die TVmaze nicht kennt, und andere Serien mit gleichem Titel: „The Office“ findet die
US-Serie von 2005 (#526), die britische von 2001 ist #1292. Um eine andere zu wählen, schreib ihre ID
statt des Titels. Höchstens 25 Serien pro Person.

Der Kalender ist zuerst **privat**. **Teile** ihn (der Schalter unter „Meine Kalender“), um ihn im
Dashboard zu sehen und in Szenen zu nutzen: Wie bei jedem Gladys-Kalender erreichen nur geteilte
Kalender die Szenen, und ein geteilter Kalender ist für den ganzen Haushalt sichtbar.

Die **Administration** wählt die Sprache der Daten und Status, die an die Szenen gehen. Name und
Beschreibung der Kalender folgen der Sprache jeder Person.

## Aktionen

Auf der Seite der Integration, für die Administration:

- **Prüfen**: liest TVmaze jetzt für alle Personen neu und nennt die Zahl der gelesenen Serien und
  kommenden Folgen.
- **Serie suchen**: Gib einen Titel ein und erhalte die besten Treffer von TVmaze mit Jahr, Sender und
  ID, zum Kopieren in eine Liste.

## Szenen

**Auslöser „Folge heute“**: Eine verfolgte Serie (auf einem geteilten Kalender) zeigt heute eine
Folge. Der Filter **Wann** wählt den Moment: **morgens** (9:00) oder **zur Sendezeit** (ebenfalls 9:00
bei einer Folge ohne Uhrzeit). Der Filter **Serie** nimmt den genauen Titel wie im Kalender; leer:
alle Serien. Variablen: Serie, Titel der Folge, Code (S02E10), Staffel, Nummer der Folge, Sender,
Datum, Sendezeit und die Personen, die die Serie verfolgen.

**Auslöser „Neue Folge angekündigt“**: Eine verfolgte Serie ohne nächste Folge bekommt eine: neue
Staffel datiert, Rückkehr nach einer Pause. Dieselben Variablen, dazu die verbleibenden Tage.

**Aktion „Nächste Folge lesen“**: die nächste Folge einer Serie (ihr Titel oder sein Anfang; leer:
die nächste aller Serien), mit `found` (1 oder 0), Folge, Code, Datum, `days_left` (-1 ohne Termin),
Sender, Status der Serie und zuletzt gesendeter Folge.

**Beispiele**:

- _Den Haushalt am Sendetag informieren_: Auslöser „Folge heute“, Wann „Morgens“, dann die
  Gladys-Aktion „Nachricht senden“ an die gewählten Personen, ihr Text mit den Variablen Serie, Code
  und Sender aus der Liste. Nichts wird gesendet, solange du keine solche Szene anlegst.
- _Licht zur Sendezeit dimmen_: Auslöser „Folge heute“, Wann „Zur Sendezeit“, Serie „The Simpsons“,
  dann eine Lichtaktion.
- _Wöchentliche Erinnerung_: eine geplante Szene am Sonntagabend, die Aktion „Nächste Folge lesen“,
  dann eine Nachricht mit den Ausgaben Serie und Datum.

## Dashboard

Füge das Widget **Nächste Folgen** zu einem Dashboard hinzu. Einstellungen: die anzuzeigenden Serien
(genaue Titel; leer: alle geteilten Serien), der Zeitraum (7, 14 oder 31 Tage) und ob der Stand jeder
Serie angezeigt wird.

## Grenzen

- **Daten**: der TV-Guide von TVmaze. Die Zeiten sind die des Originalsenders, umgerechnet in die
  Zeitzone von Gladys: Eine US-Serie um 20:00 in New York erscheint um 2:00 in Berlin. Lokale
  Ausstrahlungen (ein deutscher Sender zeigt eine US-Serie) sind nicht abgedeckt.
- **Aktualisierung**: alle 6 Stunden und wenn eine Person ihre Liste ändert. TVmaze erlaubt 20 Aufrufe
  alle 10 Sekunden: Die Integration verteilt ihre Aufrufe und liest jede Serie nur einmal, egal wie
  viele Personen sie verfolgen.
- Eine Folge ohne Sendedatum (angekündigt) kommt erst in den Kalender, wenn TVmaze sie datiert.
- Höchstens 500 Folgen pro Kalender (weit mehr als ein Jahr wöchentlicher Serien).

## Fehlerbehebung

- **Der Kalender bleibt leer**: Lies seine Beschreibung (Kalenderseite von Gladys). „Nicht auf TVmaze
  gefunden“ heißt, dass der Titel nichts gefunden hat: Suche ihn mit der Aktion „Serie suchen“ und
  nimm seine ID.
- **Falsche Serie**: Schreib ihre ID (`#1292`) statt des Titels.
- **Keine Szene löst aus**: Der Kalender muss geteilt sein, und der Serienfilter muss der genaue Titel
  sein.
- **„TVmaze nicht erreichbar“**: Die Integration behält die bekannten Folgen und versucht es erneut,
  nach einer Minute, dann immer seltener. Logs: Seite der Integration, Tab Logs (`LOG_LEVEL=debug`
  für mehr Details).

## Danksagung

Die Daten der Serien und Folgen, Zusammenfassungen inbegriffen, stammen von
[TVmaze](https://www.tvmaze.com/api) unter der Lizenz
[CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). Jede Kalender- und Terminbeschreibung
nennt TVmaze.
