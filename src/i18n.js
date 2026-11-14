// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of the Gladys
// interface. The calendar name and description follow the language of the
// user who owns the calendar; scene texts follow the `language` setting (a
// scene action carries no user); the widget the language of the viewer.
// Show and episode titles come from TVmaze, untranslated.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** Labels of the show statuses (src/shows.js STATUS_CODES). */
export const STATUS_TEXT = {
  en: {
    scheduled: 'Next episode dated',
    running: 'Running, no date yet',
    tbd: 'Future undecided',
    in_development: 'In development',
    ended: 'Ended',
  },
  fr: {
    scheduled: 'Prochain épisode daté',
    running: 'En cours, sans date',
    tbd: 'Avenir incertain',
    in_development: 'En développement',
    ended: 'Terminée',
  },
  de: {
    scheduled: 'Nächste Folge datiert',
    running: 'Läuft, noch ohne Termin',
    tbd: 'Zukunft ungewiss',
    in_development: 'In Entwicklung',
    ended: 'Beendet',
  },
  es: {
    scheduled: 'Próximo episodio con fecha',
    running: 'En emisión, sin fecha',
    tbd: 'Futuro incierto',
    in_development: 'En desarrollo',
    ended: 'Finalizada',
  },
};

/** The other texts. Functions take the value they show. */
export const TEXT = {
  en: {
    calendar: 'TV shows',
    following: 'Followed:',
    none: 'No show yet: add titles or TVmaze ids in the settings of your account.',
    notFound: 'Not found on TVmaze:',
    unavailable: 'TVmaze unreachable, retried later:',
    sameTitle: (title) => `Same title as "${title}":`,
    tooMany: (count) => `${count} more ignored (25 shows at most)`,
    credit: 'Data: TVmaze.com (CC BY-SA)',
    today: 'Today',
    tomorrow: 'Tomorrow',
    inDays: (count) => `In ${count} days`,
    noDate: 'No date yet',
    loading: 'Reading TVmaze…',
    noShared: 'No shared TV shows calendar: share yours from the TV shows integration page.',
    nothing: 'No episode in this period.',
    searchEmpty: (query) => `Nothing found on TVmaze for "${query}".`,
    searchFound: (list) => `Found: ${list}. Add the id (#…) to your list.`,
    searchMissing: 'Type a title to search.',
    check: (shows, episodes) => `TVmaze read: ${shows} show(s), ${episodes} upcoming episode(s).`,
    checkFailed: 'TVmaze could not be read. Try again in a few minutes.',
  },
  fr: {
    calendar: 'Séries TV',
    following: 'Suivies :',
    none: 'Aucune série : ajoutez des titres ou des identifiants TVmaze dans votre compte.',
    notFound: 'Introuvable sur TVmaze :',
    unavailable: 'TVmaze injoignable, nouvel essai plus tard :',
    sameTitle: (title) => `Même titre que « ${title} » :`,
    tooMany: (count) => `${count} de plus ignorée(s) (25 séries au plus)`,
    credit: 'Données : TVmaze.com (CC BY-SA)',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    inDays: (count) => `Dans ${count} jours`,
    noDate: 'Pas encore de date',
    loading: 'Lecture de TVmaze…',
    noShared:
      "Aucun calendrier de séries partagé : partagez le vôtre depuis la page de l'intégration.",
    nothing: 'Aucun épisode sur cette période.',
    searchEmpty: (query) => `Rien trouvé sur TVmaze pour « ${query} ».`,
    searchFound: (list) => `Trouvé : ${list}. Ajoutez l'identifiant (#…) à votre liste.`,
    searchMissing: 'Saisissez un titre à chercher.',
    check: (shows, episodes) => `TVmaze lu : ${shows} série(s), ${episodes} épisode(s) à venir.`,
    checkFailed: 'TVmaze est illisible. Réessayez dans quelques minutes.',
  },
  de: {
    calendar: 'Serien',
    following: 'Verfolgt:',
    none: 'Noch keine Serie: Füge Titel oder TVmaze-IDs in deinem Konto hinzu.',
    notFound: 'Nicht auf TVmaze gefunden:',
    unavailable: 'TVmaze nicht erreichbar, später neuer Versuch:',
    sameTitle: (title) => `Gleicher Titel wie „${title}“:`,
    tooMany: (count) => `${count} weitere ignoriert (höchstens 25 Serien)`,
    credit: 'Daten: TVmaze.com (CC BY-SA)',
    today: 'Heute',
    tomorrow: 'Morgen',
    inDays: (count) => `In ${count} Tagen`,
    noDate: 'Noch kein Termin',
    loading: 'TVmaze wird gelesen…',
    noShared: 'Kein geteilter Serienkalender: Teile deinen auf der Seite der Integration.',
    nothing: 'Keine Folge in diesem Zeitraum.',
    searchEmpty: (query) => `Nichts auf TVmaze gefunden für „${query}“.`,
    searchFound: (list) => `Gefunden: ${list}. Füge die ID (#…) deiner Liste hinzu.`,
    searchMissing: 'Gib einen Titel zum Suchen ein.',
    check: (shows, episodes) => `TVmaze gelesen: ${shows} Serie(n), ${episodes} kommende Folge(n).`,
    checkFailed: 'TVmaze ist nicht lesbar. Versuche es in ein paar Minuten erneut.',
  },
  es: {
    calendar: 'Series de TV',
    following: 'Seguidas:',
    none: 'Ninguna serie: añada títulos o identificadores de TVmaze en su cuenta.',
    notFound: 'No encontrada en TVmaze:',
    unavailable: 'TVmaze inaccesible, nuevo intento más tarde:',
    sameTitle: (title) => `Mismo título que «${title}»:`,
    tooMany: (count) => `${count} más ignorada(s) (25 series como máximo)`,
    credit: 'Datos: TVmaze.com (CC BY-SA)',
    today: 'Hoy',
    tomorrow: 'Mañana',
    inDays: (count) => `Dentro de ${count} días`,
    noDate: 'Aún sin fecha',
    loading: 'Leyendo TVmaze…',
    noShared:
      'Ningún calendario de series compartido: comparta el suyo desde la página de la integración.',
    nothing: 'Ningún episodio en este periodo.',
    searchEmpty: (query) => `Nada encontrado en TVmaze para «${query}».`,
    searchFound: (list) => `Encontrado: ${list}. Añada el identificador (#…) a su lista.`,
    searchMissing: 'Escriba un título para buscar.',
    check: (shows, episodes) =>
      `TVmaze leído: ${shows} serie(s), ${episodes} episodio(s) próximo(s).`,
    checkFailed: 'No se pudo leer TVmaze. Inténtelo de nuevo en unos minutos.',
  },
};

/** The table of a language, English when unknown. */
export const pick = (table, language) => table[language] ?? table.en;

/** Every language of a table entry, for an action message `{ en, fr, de, es }`. */
export function allLanguages(render) {
  return Object.fromEntries(Object.keys(TEXT).map((language) => [language, render(language)]));
}

/** `ven. 20 nov., 21:00`, or `ven. 20 nov.` for an episode without a time. */
export function formatWhen(episode, language) {
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  if (!episode.fullDay) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, options).format(
    new Date(episode.start),
  );
}

/** `21:00` local, or '' for an episode without a time. */
export function formatTime(episode) {
  if (episode.fullDay) {
    return '';
  }
  const date = new Date(episode.start);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Today, tomorrow, in N days. */
export function relativeDay(days, language) {
  const text = pick(TEXT, language);
  if (days <= 0) {
    return text.today;
  }
  return days === 1 ? text.tomorrow : text.inDays(days);
}
