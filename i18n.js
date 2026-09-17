(function(){
  'use strict';

  var STORAGE_KEY='graph1ks_ui_language_v1';
  var SUPPORTED=new Set(['en','de']);
  var saved='';
  try{saved=localStorage.getItem(STORAGE_KEY)||'';}catch(_){ }
  var browserLang=String((navigator.languages&&navigator.languages[0])||navigator.language||'en').toLowerCase();
  var language=SUPPORTED.has(saved)?saved:(browserLang.indexOf('de')===0?'de':'en');

  var DE={
    'DATA ▾':'DATEN ▾','TOOLS ▾':'TOOLS ▾','DATABASE ▾':'DATENBANK ▾',
    'Import Active Vault DB':'Aktive Vault-DB importieren','Export Active Vault DB':'Aktive Vault-DB exportieren',
    'Export Genres':'Genres exportieren','Import Genre Map':'Genre-Zuordnung importieren','DB Manager':'DB-Manager',
    'Always on Top':'Immer im Vordergrund','✓ Always on Top':'✓ Immer im Vordergrund','Sidebar ↔':'Seitenleiste ↔','GUIDED TOUR':'GEFÜHRTE TOUR','Replay the interactive extension tour':'Interaktive Extension-Tour erneut starten',
    'Overlay opacity':'Overlay-Deckkraft','Restore Factory PUBLIC Vault':'PUBLIC Vault auf Werkzustand zurücksetzen',
    'Delete Active Vault Data':'Aktive Vault-Daten löschen','PUBLIC VAULT':'PUBLIC VAULT','PRIVATE VAULT':'PRIVATE VAULT',
    'UPDATE FROM SUNO':'VON SUNO AKTUALISIEREN','EDITOR MODE':'EDITOR-MODUS','R · RETRIEVE':'R · ABRUFEN',
    'All fields':'Alle Felder','Title':'Titel','Genre':'Genre','BPM':'BPM','Emotion':'Emotion','Year':'Jahr',
    'Reference artist':'Referenzkünstler','Reference song':'Referenzsong','All Genres':'Alle Genres',
    'OPEN SELECTED':'AUSWAHL ÖFFNEN','CLEAR MAJORS':'MAJORS LEEREN','GRAPH1KS 24 MAJOR GENRES':'GRAPH1KS 24 HAUPTGENRES','ALL TRACKS':'ALLE TRACKS','SHOW':'ANZEIGEN','RANDOM SELECTION':'ZUFALLSAUSWAHL','RESET FILTERS':'FILTER ZURÜCKSETZEN',
    'RANDOM SELECTOR':'ZUFALLSAUSWAHL','ALL MAJORS':'ALLE MAJORS','FROM YEAR':'VON JAHR','TO YEAR':'BIS JAHR','SONGS / YEAR':'SONGS / JAHR','RANDOM':'ZUFALL',
    'COLLECTED GENRES':'GESAMMELTE GENRES','All':'Alle','Unused':'Ungenutzt','Used':'Benutzt','Favorites':'Favoriten',
    'Select Visible':'Sichtbare auswählen','Clear Selection':'Auswahl aufheben','✓ Mark Used':'✓ Als benutzt markieren','Mark Unused':'Als unbenutzt markieren',
    '★ Favorite':'★ Favorit','☆ Unfavorite':'☆ Favorit entfernen','Delete Selected':'Auswahl löschen','RANDOM VIEW ×':'ZUFALLSANSICHT ×',
    'DATABASE MANAGER':'DATENBANK-MANAGER','active-vault bulk replace · normalize · patch · undo':'aktive Vault gesammelt ersetzen · normalisieren · patchen · rückgängig',
    'CLOSE':'SCHLIESSEN','REPLACE / MERGE':'ERSETZEN / ZUSAMMENFÜHREN','NORMALIZE VALUES':'WERTE NORMALISIEREN','PATCH / UPDATE JSON':'PATCH / JSON AKTUALISIEREN','HISTORY / RULES':'VERLAUF / REGELN',
    'Field':'Feld','Scope':'Bereich','Match':'Treffer','Action':'Aktion','Style':'Stil','Key':'Tonart','Reference Artist':'Referenzkünstler','Reference Song':'Referenzsong',
    'Creation Date':'Erstellungsdatum','Artist':'Künstler','Favorite':'Favorit','Structured Prompt':'Strukturierter Prompt','Negative Prompt':'Negativer Prompt','Arrangement':'Arrangement','Style Tag':'Style-Tag','Lyrics/Arrangement':'Lyrics/Arrangement',
    'Entire database':'Gesamte Datenbank','Current filtered view':'Aktuell gefilterte Ansicht','Selected tracks':'Ausgewählte Tracks','Used tracks':'Benutzte Tracks','Unused tracks':'Unbenutzte Tracks','Favorite tracks':'Favoriten',
    'Exact · ignore case':'Exakt · Groß/Kleinschreibung ignorieren','Exact · case sensitive':'Exakt · Groß/Kleinschreibung beachten','Contains':'Enthält','Starts with':'Beginnt mit','Ends with':'Endet mit','Regular expression':'Regulärer Ausdruck',
    'Replace whole value':'Gesamten Wert ersetzen','Replace matched portion':'Treffer ersetzen','Prepend':'Voranstellen','Append':'Anhängen','Clear value':'Wert leeren',
    'Find':'Suchen','Replace with':'Ersetzen durch','Case-sensitive Contains / Starts / Ends / Regex':'Groß/Kleinschreibung bei Enthält / Beginnt / Endet / Regex beachten',
    'Genre rename: merge / move Major Genre relationships':'Genre-Umbenennung: Major-Genre-Zuordnungen zusammenführen / verschieben',
    'Exact replacement: remember as canonical for future imports':'Exakten Ersatz als Standard für zukünftige Importe merken',
    'ANALYZE VALUES':'WERTE ANALYSIEREN','PREVIEW CHANGES':'ÄNDERUNGEN VORSCHAUEN','SAVE AS RULE':'ALS REGEL SPEICHERN','DISTINCT VALUES':'EINDEUTIGE WERTE',
    'Choose a lightweight field and analyze.':'Ein kompaktes Feld wählen und analysieren.','No value analysis yet.':'Noch keine Wertanalyse.',
    'Apply saved canonical spellings automatically to future DB imports':'Gespeicherte Standardschreibweisen automatisch auf zukünftige DB-Importe anwenden',
    'ANALYZE SAFE VARIANTS':'SICHERE VARIANTEN ANALYSIEREN','SELECT ALL GROUPS':'ALLE GRUPPEN AUSWÄHLEN','CLEAR':'LEEREN','PREVIEW NORMALIZATION':'NORMALISIERUNG VORSCHAUEN',
    'Safe variants differ only by case, Unicode form or whitespace. Punctuation differences are not auto-merged.':'Sichere Varianten unterscheiden sich nur durch Groß-/Kleinschreibung, Unicode-Form oder Leerzeichen. Unterschiede bei Satzzeichen werden nicht automatisch zusammengeführt.',
    'Canonical spellings applied here are remembered for future imports.':'Hier angewendete Standardschreibweisen werden für zukünftige Importe gespeichert.',
    'Analyze a field to find variants such as “Easy Listening”, “easy listening” and “Easy listening”.':'Analysiere ein Feld, um Varianten wie „Easy Listening“, „easy listening“ und „Easy listening“ zu finden.',
    'Partial database updates. Only the declared field is changed; everything else stays untouched.':'Teilweise Datenbank-Updates. Nur das angegebene Feld wird geändert; alles andere bleibt unverändert.',
    'FORMAT HELP':'FORMAT-HILFE','LOAD PATCH JSON':'PATCH-JSON LADEN','CLEAR PATCH':'PATCH LEEREN','No patch loaded.':'Kein Patch geladen.',
    'Patches are preview-only until you press APPLY PREVIEWED CHANGES. Match by GRAPH1KS ID or, in Private Vaults, by Suno Song ID.':'Patches bleiben nur Vorschau, bis du VORSCHAU-ÄNDERUNGEN ANWENDEN drückst. Zuordnung per GRAPH1KS-ID oder in Private Vaults per Suno-Song-ID.',
    'UNDO HISTORY':'RÜCKGÄNGIG-VERLAUF','REFRESH':'AKTUALISIEREN','SAVED CLEANUP RULES':'GESPEICHERTE BEREINIGUNGSREGELN','IMPORT':'IMPORTIEREN','EXPORT':'EXPORTIEREN',
    'Load a saved rule into Replace / Merge, preview it, then apply. Rules never execute silently.':'Lade eine gespeicherte Regel in Ersetzen / Zusammenführen, prüfe die Vorschau und wende sie dann an. Regeln laufen niemals unbemerkt.',
    'CHANGE PREVIEW':'ÄNDERUNGSVORSCHAU','No preview calculated.':'Keine Vorschau berechnet.','Run a preview before applying any database change.':'Erstelle eine Vorschau, bevor Datenbankänderungen angewendet werden.',
    'APPLY PREVIEWED CHANGES':'VORSCHAU-ÄNDERUNGEN ANWENDEN','CANCEL':'ABBRECHEN',
    'Major':'Major','Fav':'Fav','No tracks match the current filters.':'Keine Tracks passen zu den aktuellen Filtern.',
    'TITLE REQUIRED':'TITEL ERFORDERLICH',"Suno's current Create form has no title. Give this retrieved item a title before it can be saved to the Private Vault.":'Das aktuelle Suno-Create-Formular hat keinen Titel. Gib dem abgerufenen Eintrag einen Titel, bevor er in der Private Vault gespeichert werden kann.',
    'SAVE TO PRIVATE VAULT':'IN PRIVATE VAULT SPEICHERN','VAULT EDITOR':'VAULT-EDITOR','Manual song entry · active Private Vault':'Manueller Song-Eintrag · aktive Private Vault','CLOSE':'SCHLIESSEN','SUNO MORE OPTIONS':'SUNO MORE OPTIONS','SONG CONTENT':'SONG-INHALT','Major Genre(s)':'Major-Genre(s)','Subgenre':'Subgenre','Voice Name':'Voice-Name','Voice URL':'Voice-URL','Vocal Gender':'Stimmgeschlecht','Duration':'Dauer','Max Mode':'Max-Modus','Weirdness':'Weirdness','Style Influence':'Style-Einfluss','Audio Influence':'Audio-Einfluss','Variety':'Variety','Suno Settings':'Suno-Daten','Negative Prompt / Exclusion':'Negativer Prompt / Exclusion','AUTO FIT':'AUTO-FIT','✓ AUTO FIT':'✓ AUTO-FIT','SAVING…':'WIRD GESPEICHERT…','GRAPH1KS PATCH / UPDATE JSON':'GRAPH1KS PATCH / JSON-UPDATE',
    'A patch changes one declared field only. It never replaces whole track records.':'Ein Patch ändert nur ein angegebenes Feld. Er ersetzt niemals komplette Track-Datensätze.',
    'Single-song patch:':'Einzel-Song-Patch:','Private Vault matching:':'Private-Vault-Zuordnung:','Protected provenance:':'Geschützte Herkunftsdaten:',
    'Control Deck is in always-on-top mode.':'Control Deck ist im Immer-im-Vordergrund-Modus.',
    'AUTO-HIDE':'AUTO-HIDE','✓ AUTO-HIDE':'✓ AUTO-HIDE','↗ POP OUT':'↗ POP-OUT','⇥ DOCK TO SUNO':'⇥ AN SUNO ANDOCKEN',
    'Search tracks…':'Tracks suchen…','Search collected genres…':'Gesammelte Genres suchen…','Clear search':'Suche leeren','Optional: choose a Major Genre, or enter a mapped Subgenre to fill it automatically.':'Optional: Wähle ein Major-Genre oder gib ein zugeordnetes Subgenre ein, damit es automatisch gesetzt wird.','New / unmapped Subgenre: choose its Major Genre before saving.':'Neues / nicht zugeordnetes Subgenre: Wähle vor dem Speichern sein Major-Genre.',
    'Value or pattern to find…':'Wert oder Suchmuster…','Canonical / replacement value…':'Standard-/Ersatzwert…','Title…':'Titel…','Style prompt…':'Style-Prompt…','Excluded styles / negative prompt…':'Ausgeschlossene Styles / negativer Prompt…','Lyrics / arrangement…':'Lyrics / Arrangement…','Type to search canonical subgenres…':'Tippen, um kanonische Subgenres zu suchen…','Selected Suno voice…':'Ausgewählte Suno-Voice…','AUTO or 3:35':'AUTO oder 3:35',
    'Select a track to inspect, edit or autofill.':'Wähle einen Track zum Prüfen, Bearbeiten oder Autofill aus.','Loading track details…':'Track-Details werden geladen…',
    'Copy':'Kopieren','Copy Error':'Fehler kopieren','ARTIST':'KÜNSTLER','LOCKED':'GESPERRT','SUNO SONG ID':'SUNO SONG ID',
    'GENRE MANUAL OVERRIDE':'GENRE MANUELL ÜBERSCHRIEBEN','GENRE UNCLASSIFIED':'GENRE NICHT KLASSIFIZIERT','AUTOFILL SUNO':'SUNO AUTOFILL','AUTOFILLING…':'AUTOFILL…','ERROR — RETRY':'FEHLER — ERNEUT',
    'Autofill stopped. Diagnostic remains below.':'Autofill gestoppt. Diagnose bleibt unten sichtbar.','Verified fill · Styles and Advanced Options must already be open.':'Verifizierter Fill · Styles und Advanced Options müssen bereits geöffnet sein.','Verified fill · Styles must be open · More Options can be filled automatically.':'Verifizierter Fill · Styles muss geöffnet sein · More Options können automatisch gefüllt werden.',
    'AUTO USED':'AUTO USED','✓ AUTO USED':'✓ AUTO USED','AUTO NEXT':'AUTO NEXT','✓ AUTO NEXT':'✓ AUTO NEXT','FILL MORE OPTIONS':'MORE OPTIONS FÜLLEN','✓ FILL MORE OPTIONS':'✓ MORE OPTIONS FÜLLEN','AUTO FILL':'AUTO FILL','✓ AUTO FILL':'✓ AUTO FILL','SEC':'SEK','OFF':'AUS',
    'start / pause':'start / pause','fill':'fill','retrieve':'abrufen','off':'aus','Used':'Benutzt','Persistent Used state':'Dauerhafter Benutzt-Status',
    'LOCK':'SPERREN','UNLOCK EDIT':'BEARBEITUNG ENTSPERREN','SAVE':'SPEICHERN','DELETE ENTRY':'EINTRAG LÖSCHEN','CONFIRM DELETE':'LÖSCHEN BESTÄTIGEN',
    'Year · display / classification':'Jahr · Anzeige / Klassifizierung','Creation Date · actual Suno timestamp':'Erstellungsdatum · echter Suno-Zeitstempel',
    'Structured Prompt / Styles':'Strukturierter Prompt / Styles','Negative Prompt / Exclude':'Negativer Prompt / Exclude','Instrumental Arrangement / Lyrics':'Instrumental-Arrangement / Lyrics','Instrumental Arrangement':'Instrumental-Arrangement','Lyrics/Arrangement':'Lyrics/Arrangement','Style Tag':'Style-Tag',
    'No Suno identity':'Keine Suno-Identität','SUNO IDENTITY HISTORY · READ-ONLY':'SUNO-IDENTITÄTSVERLAUF · NUR LESEN','No identity history recorded yet.':'Noch kein Identitätsverlauf gespeichert.',
    'PUBLIC VAULT · established reference database':'PUBLIC VAULT · etablierte Referenzdatenbank',
    'PRIVATE VAULT · no Suno account Vault yet — press R on Suno to create one':'PRIVATE VAULT · noch keine Suno-Account-Vault — drücke R auf Suno, um eine anzulegen',
    'Artist':'Künstler','Suno Song':'Suno-Song','Random View cleared':'Zufallsansicht geleert','Showing the normal track list again.':'Normale Trackliste wird wieder angezeigt.',
    'Random View':'Zufallsansicht','Opacity update failed':'Deckkraft konnte nicht geändert werden','Surface switch failed':'Ansicht konnte nicht gewechselt werden','Auto-hide failed':'Auto-Hide fehlgeschlagen',
    'Suno inactive':'Suno inaktiv','Make Suno the active browser tab first.':'Aktiviere zuerst den Suno-Browser-Tab.','Suno must be the active browser tab.':'Suno muss der aktive Browser-Tab sein.',
    'Autofill failed':'Autofill fehlgeschlagen','Autofill stopped':'Autofill gestoppt','Auto Fill verified':'Auto Fill verifiziert','Autofill verified':'Autofill verifiziert','Saved':'Gespeichert',
    'Marked used':'Als benutzt markiert','Marked unused':'Als unbenutzt markiert','Always on Top':'Immer im Vordergrund','Topmost failed':'Immer-im-Vordergrund fehlgeschlagen','Topmost unavailable':'Immer-im-Vordergrund nicht verfügbar',
    'Public Vault failed':'Public Vault fehlgeschlagen','Private Vault failed':'Private Vault fehlgeschlagen','CHECKING…':'PRÜFE…','Suno identity updated':'Suno-Identität aktualisiert','Suno identity verified':'Suno-Identität verifiziert',
    'Identity update blocked':'Identitäts-Update blockiert','Retrieve failed':'Abruf fehlgeschlagen','Vault missing':'Vault fehlt','The target Suno Vault no longer exists.':'Die Ziel-Suno-Vault existiert nicht mehr.',
    'Private Vault save failed':'Speichern in Private Vault fehlgeschlagen','Selected':'Ausgewählt','Selection cleared':'Auswahl aufgehoben','Deleted':'Gelöscht','Restore failed':'Wiederherstellung fehlgeschlagen',
    'No Private Vault':'Keine Private Vault','Retrieve from Suno or select an existing Private Vault first.':'Rufe zuerst etwas von Suno ab oder wähle eine bestehende Private Vault.',
    'AUTO FILL disabled':'AUTO FILL deaktiviert','AUTO FILL requires AUTO USED + AUTO NEXT.':'AUTO FILL benötigt AUTO USED + AUTO NEXT.','AUTO FILL requires both':'AUTO FILL benötigt beides','Turn on AUTO USED and AUTO NEXT first.':'Aktiviere zuerst AUTO USED und AUTO NEXT.',
    'Copied':'Kopiert','Autofill diagnostic copied.':'Autofill-Diagnose kopiert.','Double-click detected':'Doppelklick erkannt','Direct fill complete':'Direkt-Fill abgeschlossen','Song was inserted into Suno and verified.':'Song wurde in Suno eingefügt und verifiziert.','Direct Fill failed':'Direkt-Fill fehlgeschlagen','F fill skipped':'F-Fill übersprungen','No track is selected.':'Kein Track ausgewählt.','F fill failed':'F-Fill fehlgeschlagen',
    'No reversible manager operations yet.':'Noch keine rückgängig machbaren Manager-Vorgänge.','No saved cleanup rules.':'Keine gespeicherten Bereinigungsregeln.','No variant groups to review.':'Keine Variantengruppen zum Prüfen.',
    'Canonical':'Standard','Track':'Track','Before':'Vorher','After':'Nachher','UNDO':'RÜCKGÄNGIG','UNDOING…':'WIRD RÜCKGÄNGIG GEMACHT…',
    'Heavy text fields are previewed directly; distinct-value browsing is disabled.':'Große Textfelder werden direkt in der Vorschau gezeigt; die Liste eindeutiger Werte ist deaktiviert.',
    'Use PREVIEW CHANGES for heavy prompt / arrangement fields.':'Nutze ÄNDERUNGEN VORSCHAUEN für große Prompt-/Arrangement-Felder.',
    'Enter a Find value.':'Gib einen Suchwert ein.','Enter a regular expression.':'Gib einen regulären Ausdruck ein.','Scanning database…':'Datenbank wird durchsucht…','Analyzing distinct values…':'Eindeutige Werte werden analysiert…',
    'Value analysis complete. Click a value to use it as Find.':'Wertanalyse abgeschlossen. Klicke einen Wert an, um ihn als Suchwert zu verwenden.',
    'Dry run complete. Nothing has been written yet.':'Testlauf abgeschlossen. Es wurde noch nichts geschrieben.','Dry run complete. No values would change.':'Testlauf abgeschlossen. Keine Werte würden sich ändern.',
    'Patch loaded. Review the dry-run preview before applying.':'Patch geladen. Prüfe die Testlauf-Vorschau vor dem Anwenden.','Patch loaded; no values would change.':'Patch geladen; keine Werte würden sich ändern.','Patch cleared.':'Patch geleert.',
    'Current':'Aktuell','CURRENT':'AKTUELL',
    'RANDOM replaces the current Random View · blank FROM + TO = full range · one filled year = single-year mode':'ZUFALL ersetzt die aktuelle Zufallsansicht · VON + BIS leer = kompletter Bereich · nur ein ausgefülltes Jahr = Einzeljahr-Modus',
    'Title A–Z':'Titel A–Z','Genre A–Z':'Genre A–Z','Emotion A–Z':'Emotion A–Z','Year ↑':'Jahr ↑','Year ↓':'Jahr ↓','Artist A–Z':'Künstler A–Z','Song A–Z':'Song A–Z','0 selected':'0 ausgewählt',
    'Safe variants differ only by case, Unicode form or whitespace. Punctuation differences are not auto-merged. Canonical spellings applied here are remembered for future imports.':'Sichere Varianten unterscheiden sich nur durch Groß-/Kleinschreibung, Unicode-Form oder Leerzeichen. Unterschiede bei Satzzeichen werden nicht automatisch zusammengeführt. Hier angewendete Standardschreibweisen werden für zukünftige Importe gespeichert.',
    'use one update object.':'verwende genau ein Update-Objekt.','All arrangements:':'Alle Arrangements:','include one update for every song you want changed.':'füge für jeden zu ändernden Song ein Update hinzu.',
    'set':'setze','and use':'und verwende','in each update.':'in jedem Update.',
    'Private Vault patches cannot modify Artist identity/profile fields, Suno Song ID/link, source URL, record type/retrieval identity, Reference Artist or Reference Song. Those fields are refreshed only from authoritative Suno retrieval/identity updates.':'Private-Vault-Patches können Künstleridentität/-profil, Suno-Song-ID/-Link, Quell-URL, Datensatztyp/Abrufidentität, Referenzkünstler oder Referenzsong nicht verändern. Diese Felder werden nur über verlässliche Suno-Abruf-/Identitätsupdates aktualisiert.',
    'Accepted field aliases:':'Akzeptierte Feld-Aliase:','You may use':'Du kannst','or under the declared field name, for example':'oder unter dem angegebenen Feldnamen speichern, zum Beispiel','. Extra fields are ignored.':'. Zusätzliche Felder werden ignoriert.',', or':', oder',
    'Could not update overlay opacity.':'Overlay-Deckkraft konnte nicht aktualisiert werden.','Could not update Auto-hide.':'Auto-Hide konnte nicht aktualisiert werden.',
    'Optimizing existing database… one-time migration to fast index/content stores.':'Bestehende Datenbank wird optimiert… einmalige Migration in schnelle Index-/Content-Speicher.',
    'Track entry is not an object.':'Track-Eintrag ist kein Objekt.','Invalid BPM.':'Ungültige BPM.','Invalid year.':'Ungültiges Jahr.','Years must be whole numbers from 0 to 9999.':'Jahre müssen ganze Zahlen von 0 bis 9999 sein.',
    'No tracks with a usable year are available in this Major Genre scope.':'In diesem Major-Genre-Bereich sind keine Tracks mit nutzbarer Jahresangabe verfügbar.',
    'Could not identify the signed-in Suno account.':'Das angemeldete Suno-Konto konnte nicht erkannt werden.','Switch to PRIVATE VAULT first.':'Wechsle zuerst zur PRIVATE VAULT.','This Private Vault is not bound to a Suno account.':'Diese Private Vault ist keinem Suno-Konto zugeordnet.',
    'Make the signed-in Suno tab active first.':'Aktiviere zuerst den angemeldeten Suno-Tab.','Could not read the current Suno account identity.':'Die aktuelle Suno-Kontoidentität konnte nicht gelesen werden.',
    'The active Suno tab is signed into a different account. Select that account Vault or switch Suno accounts first.':'Im aktiven Suno-Tab ist ein anderes Konto angemeldet. Wähle dessen Vault oder wechsle zuerst das Suno-Konto.',
    'Suno identity could not be verified by stable user ID. No identity data was changed.':'Die Suno-Identität konnte nicht über eine stabile Benutzer-ID verifiziert werden. Identitätsdaten wurden nicht verändert.',
    'This legacy Vault has no stable user ID and the active handle differs, so the rename cannot be verified safely.':'Diese ältere Vault hat keine stabile Benutzer-ID und der aktive Handle weicht ab; die Umbenennung kann daher nicht sicher verifiziert werden.',
    'Parsing JSON…':'JSON wird verarbeitet…','Expected mappings[] or genres[] in genre-map JSON.':'In der Genre-Map-JSON werden mappings[] oder genres[] erwartet.',
    'Bundled Public Vault contains no tracks.':'Die mitgelieferte Public Vault enthält keine Tracks.','Bundled Genre Map contains no usable mappings.':'Die mitgelieferte Genre-Zuordnung enthält keine nutzbaren Zuordnungen.',
    'Loading bundled GRAPH1KS Public Vault + Genre Map…':'Mitgelieferte GRAPH1KS Public Vault + Genre Map werden geladen…',
    'Database operation is running. Cancel it first or wait for completion.':'Ein Datenbankvorgang läuft. Brich ihn zuerst ab oder warte auf den Abschluss.',
    'Patch JSON must be an object.':'Patch-JSON muss ein Objekt sein.','Patch JSON needs an updates[], records[] or tracks[] array.':'Patch-JSON benötigt ein updates[]-, records[]- oder tracks[]-Array.',
    'Patch field is missing or unsupported. Use one DB field such as instrumental_arrangement.':'Das Patch-Feld fehlt oder wird nicht unterstützt. Verwende ein DB-Feld wie instrumental_arrangement.',
    'suno_song_id matching is available in a Private Vault. Public Vault patches should match by id.':'Zuordnung per suno_song_id ist in einer Private Vault verfügbar. Public-Vault-Patches sollten per ID zugeordnet werden.',
    'Select at least one normalization group.':'Wähle mindestens eine Normalisierungsgruppe aus.','Applying previewed changes…':'Vorschau-Änderungen werden angewendet…','Cancel requested. Current database chunk will finish safely…':'Abbruch angefordert. Der aktuelle Datenbankblock wird sicher abgeschlossen…',
    'Cleanup rule saved.':'Bereinigungsregel gespeichert.','Rule loaded into Replace / Merge.':'Regel in Ersetzen / Zusammenführen geladen.','Rules JSON must contain a rules[] array.':'Regel-JSON muss ein rules[]-Array enthalten.','Cleanup rule deleted.':'Bereinigungsregel gelöscht.',
    'Preparing full database export…':'Vollständiger Datenbankexport wird vorbereitet…','Fast database ready':'Schnelle Datenbank bereit','Heavy prompt text is fetched only when needed.':'Große Prompt-Texte werden nur bei Bedarf geladen.',
    'CONFIRM DELETE':'LÖSCHEN BESTÄTIGEN','CONFIRM DELETE ALL':'ALLES LÖSCHEN BESTÄTIGEN','ARE YOU REALLY SURE!?':'BIST DU WIRKLICH SICHER!?','CONFIRM REPLACE PUBLIC VAULT':'PUBLIC VAULT ERSETZEN BESTÄTIGEN','RESTORING FACTORY DATA…':'WERKSDATEN WERDEN WIEDERHERGESTELLT…',
    'Genre relationship map was preserved.':'Die Genre-Zuordnung wurde beibehalten.','No safe case/whitespace variants found.':'Keine sicheren Groß-/Kleinschreibungs- oder Leerzeichenvarianten gefunden.','No patch loaded.':'Kein Patch geladen.',
    'LOAD':'LADEN','DELETE':'LÖSCHEN','partial':'teilweise','Canonical':'Standard'
  };

  var DE_TO_EN={};Object.keys(DE).forEach(function(k){DE_TO_EN[DE[k]]=k;});
  var textState=new WeakMap();
  var attrState=new WeakMap();
  var observer=null;
  var applying=false;

  function preserveWhitespace(raw,translated){
    var lead=(raw.match(/^\s*/)||[''])[0];
    var trail=(raw.match(/\s*$/)||[''])[0];
    return lead+translated+trail;
  }

  function dynamicEnToDe(s){
    var m;
    if((m=s.match(/^(\d+) selected$/)))return m[1]+' ausgewählt';
    if((m=s.match(/^SHOW \((\d+)\)$/)))return 'ANZEIGEN ('+m[1]+')';
    if((m=s.match(/^(\d+) tracks selected\.$/)))return m[1]+' Tracks ausgewählt.';
    if((m=s.match(/^(\d+) tracks deselected\.$/)))return m[1]+' Tracks abgewählt.';
    if((m=s.match(/^(\d+) tracks updated\.$/)))return m[1]+' Tracks aktualisiert.';
    if((m=s.match(/^(\d+) tracks removed\.$/)))return m[1]+' Tracks entfernt.';
    if((m=s.match(/^Track #(\d+) updated\.$/)))return 'Track #'+m[1]+' aktualisiert.';
    if((m=s.match(/^Track #(\d+) removed\.$/)))return 'Track #'+m[1]+' entfernt.';
    if((m=s.match(/^(\d+) year-tagged tracks$/)))return m[1]+' Tracks mit Jahresangabe';
    if((m=s.match(/^(\d+) tracks$/)))return m[1]+' Tracks';
    if((m=s.match(/^Showing first (\d+) of (\d+) changes\.$/)))return 'Zeige die ersten '+m[1]+' von '+m[2]+' Änderungen.';
    if((m=s.match(/^Showing first (\d+) of (\d+) distinct values\.$/)))return 'Zeige die ersten '+m[1]+' von '+m[2]+' eindeutigen Werten.';
    if((m=s.match(/^(\d+) distinct values across (\d+) tracks$/)))return m[1]+' eindeutige Werte in '+m[2]+' Tracks';
    if((m=s.match(/^(\d+) changes · (\d+) records scanned · (.+)$/)))return m[1]+' Änderungen · '+m[2]+' Datensätze geprüft · '+translateString(m[3],'de');
    if((m=s.match(/^(\d+) safe normalization group\(s\) found\.$/)))return m[1]+' sichere Normalisierungsgruppe(n) gefunden.';
    if((m=s.match(/^RANDOM VIEW · (\d+) ×$/)))return 'ZUFALLSANSICHT · '+m[1]+' ×';
    if((m=s.match(/^(\d+) MAJOR(S?) · (.+)$/)))return m[1]+' MAJOR'+(m[2]?'S':'')+' · '+m[3];
    if((m=s.match(/^UNMAPPED (\d+)$/)))return 'NICHT ZUGEORDNET '+m[1];
    if((m=s.match(/^Import (PRIVATE|PUBLIC) Vault DB$/)))return (m[1]==='PRIVATE'?'PRIVATE':'PUBLIC')+' Vault-DB importieren';
    if((m=s.match(/^Export (PRIVATE|PUBLIC) Vault DB$/)))return (m[1]==='PRIVATE'?'PRIVATE':'PUBLIC')+' Vault-DB exportieren';
    if((m=s.match(/^Delete (PRIVATE|PUBLIC) Vault Data$/)))return (m[1]==='PRIVATE'?'PRIVATE':'PUBLIC')+' Vault-Daten löschen';
    if((m=s.match(/^(.+) · (\d+) tracks · (\d+) visible · (\d+) used · (\d+) favorites$/)))return m[1]+' · '+m[2]+' Tracks · '+m[3]+' sichtbar · '+m[4]+' benutzt · '+m[5]+' Favoriten';
    if((m=s.match(/^(.+) · (\d+) tracks · (\d+) canonical spellings$/)))return m[1]+' · '+m[2]+' Tracks · '+m[3]+' Standardschreibweisen';
    if((m=s.match(/^PUBLIC VAULT · established reference database · (\d+) tracks$/)))return 'PUBLIC VAULT · etablierte Referenzdatenbank · '+m[1]+' Tracks';
    if((m=s.match(/^(.+) · (\d+) tracks$/)))return m[1]+' · '+m[2]+' Tracks';
    if((m=s.match(/^(\d+) tracks · (.+) · up to (\d+)\/year\.$/)))return m[1]+' Tracks · '+m[2]+' · bis zu '+m[3]+'/Jahr.';
    if((m=s.match(/^(\d+) owned track\(s\) synchronized\.$/)))return m[1]+' eigene(r) Track(s) synchronisiert.';
    if((m=s.match(/^(\d+) tracks · (\d+) genre mappings\.$/)))return m[1]+' Tracks · '+m[2]+' Genre-Zuordnungen.';
    if((m=s.match(/^(\d+) tracks$/)))return m[1]+' Tracks';
    if((m=s.match(/^(.+) cleared$/)))return m[1]+' geleert';
    if((m=s.match(/^Retrieved to (.+)$/)))return 'Abgerufen nach '+m[1];
    if((m=s.match(/^AUTO from Subgenre: (.+)$/)))return 'AUTO aus Subgenre: '+m[1];
    return s;
  }

  function translateString(value,target){
    var raw=String(value==null?'':value);
    var trimmed=raw.trim();
    if(!trimmed)return raw;
    var normalized=trimmed.replace(/\s+/g,' ');
    if(target==='de'){
      var canonical=DE_TO_EN[trimmed]||DE_TO_EN[normalized]||normalized;
      var out=Object.prototype.hasOwnProperty.call(DE,canonical)?DE[canonical]:dynamicEnToDe(trimmed);
      return preserveWhitespace(raw,out);
    }
    var en=DE_TO_EN[trimmed]||DE_TO_EN[normalized]||trimmed;
    return preserveWhitespace(raw,en);
  }

  function shouldSkipText(node){
    var p=node.parentElement;if(!p)return true;
    if(p.closest('#languageToggle, #trackBody, pre, code, textarea, input, .majorName, .genreRowName, .dbmClip, .dbmValueRow span, .dbmVariantSource span, .inspectHeader h2, #privateIdentityCurrent'))return true;
    if(p.closest('.privateMetaItem > div'))return true;
    return false;
  }

  function translateTextNode(node,force){
    if(!node||node.nodeType!==Node.TEXT_NODE||shouldSkipText(node))return;
    var raw=node.data;if(!raw||!raw.trim())return;
    var st=textState.get(node);
    if(!st||raw!==st.last){st={source:(DE_TO_EN[raw.trim()]||raw.trim()),last:raw};textState.set(node,st);}
    var output=translateString(st.source,language);
    output=preserveWhitespace(raw,output.trim());
    st.last=output;
    if(node.data!==output)node.data=output;
  }

  function translateAttrs(el){
    if(!el||el.nodeType!==Node.ELEMENT_NODE)return;
    if(el.id==='languageToggle')return;
    var attrs=['title','placeholder','aria-label'];
    var st=attrState.get(el)||{};
    attrs.forEach(function(name){
      if(!el.hasAttribute(name))return;
      var raw=el.getAttribute(name)||'';
      var item=st[name];
      if(!item||raw!==item.last)item={source:(DE_TO_EN[raw.trim()]||raw),last:raw};
      var output=translateString(item.source,language);
      item.last=output;st[name]=item;
      if(raw!==output)el.setAttribute(name,output);
    });
    attrState.set(el,st);
  }

  function process(root){
    if(applying)return;applying=true;
    try{
      if(root&&root.nodeType===Node.TEXT_NODE){translateTextNode(root,true);return;}
      var base=root&&root.nodeType===Node.ELEMENT_NODE?root:document.documentElement;
      translateAttrs(base);
      var walker=document.createTreeWalker(base,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      var n=walker.currentNode;
      while(n){if(n.nodeType===Node.TEXT_NODE)translateTextNode(n,true);else translateAttrs(n);n=walker.nextNode();}
    }finally{applying=false;}
  }

  function updateToggle(){
    var btn=document.getElementById('languageToggle');if(!btn)return;
    if(language==='de'){
      btn.innerHTML='<span class="languageFlag" aria-hidden="true"><svg class="flagSvg" viewBox="0 0 5 3" focusable="false" aria-hidden="true"><rect width="5" height="1" y="0" fill="#000000"/><rect width="5" height="1" y="1" fill="#DD0000"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg></span><span class="languageCode">DE</span>';
      btn.title='Switch to English';btn.setAttribute('aria-label','Switch to English');
    }else{
      btn.innerHTML='<span class="languageFlag" aria-hidden="true"><svg class="flagSvg" viewBox="0 0 60 30" focusable="false" aria-hidden="true"><defs><clipPath id="g1UkSaltire"><path d="M30 15h30v15zM30 15v15H0zM30 15H0V0zM30 15V0h30z"/></clipPath></defs><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" clip-path="url(#g1UkSaltire)" stroke="#C8102E" stroke-width="4"/><path d="M30 0V30M0 15H60" stroke="#FFFFFF" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#C8102E" stroke-width="6"/></svg></span><span class="languageCode">EN</span>';
      btn.title='Auf Deutsch umstellen';btn.setAttribute('aria-label','Auf Deutsch umstellen');
    }
  }

  function setLanguage(next){
    next=SUPPORTED.has(next)?next:'en';language=next;
    try{localStorage.setItem(STORAGE_KEY,next);}catch(_){ }
    document.documentElement.lang=next;
    document.documentElement.setAttribute('data-g1-language',next);
    process(document.documentElement);updateToggle();
    try{window.dispatchEvent(new CustomEvent('graph1ks-language-changed',{detail:{language:next}}));}catch(_){ }
  }

  function start(){
    document.documentElement.lang=language;
    document.documentElement.setAttribute('data-g1-language',language);
    updateToggle();process(document.documentElement);
    var btn=document.getElementById('languageToggle');
    if(btn)btn.addEventListener('click',function(){setLanguage(language==='de'?'en':'de');});
    observer=new MutationObserver(function(records){
      if(applying)return;
      records.forEach(function(r){
        if(r.type==='characterData')translateTextNode(r.target,false);
        else if(r.type==='attributes')translateAttrs(r.target);
        else Array.from(r.addedNodes||[]).forEach(function(n){process(n);});
      });
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});
  }

  window.G1I18N={getLanguage:function(){return language;},setLanguage:setLanguage,t:function(value){return translateString(value,language);},apply:process};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
