# Mazzi persistenti e immagini

## Configurazione

1. Crea un progetto Supabase. In **SQL Editor**, esegui
   `supabase/migrations/202611170001_decks.sql` e poi
   `supabase/migrations/202611170002_public_profiles.sql` e
   `supabase/migrations/202611170003_deck_discussions.sql`. Per abilitare modifica
   ed eliminazione dei commenti, esegui anche
   `supabase/migrations/202611200001_manage_deck_comments.sql`. La prima migrazione
   crea tabella, indici, trigger, regole RLS e bucket privato per gli sfondi.
2. In **Authentication → Sign In / Providers**, abilita Discord. Crea un'app
   nel Discord Developer Portal, aggiungi il Callback URL mostrato da Supabase
   fra i Redirects dell'app e copia Client ID e Client Secret nel provider
   Discord di Supabase. In **URL Configuration**, imposta il dominio Vercel come
   Site URL e consenti `https://astralia-sim.vercel.app/my-decks` nei Redirect
   URLs (oltre alle preview che usi e a `http://localhost:5173/**` per lo
   sviluppo locale). L'interfaccia usa solo Discord per accedere e lascia
   disponibili i mazzi locali senza account. Se in futuro riattivi la
   registrazione email, configura prima un SMTP personalizzato.
3. In Vercel, imposta `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` per gli ambienti appropriati e ricompila il
   frontend. Per lo sviluppo locale, inseriscile in `client/.env.local`.
   La chiave pubblicabile è destinata al browser. Non usare una secret key o
   `service_role` con prefisso `VITE_`.
4. Apri **My Decks**, accedi con Discord, salva un mazzo, esci e rientra.
   Prova anche da un altro browser. Per i mazzi precedenti usa **Copy local
   decks**: l'operazione è ripetibile e conserva gli originali sul dispositivo.

### Trasferire i mazzi dal vecchio sito Render

Il browser separa i dati di `astralia-deck-lab.onrender.com` da quelli di
`astralia-sim.vercel.app`: **Copy local decks** vede solo i mazzi dell'indirizzo
che stai visitando.

1. Apri `https://astralia-deck-lab.onrender.com/my-decks` nello stesso browser e
   profilo in cui avevi salvato i mazzi. Premi **Download browser decks** e
   conserva il file JSON. Il vecchio sito deve avere distribuita la versione
   che contiene questo pulsante.
2. Apri `https://astralia-sim.vercel.app/my-decks` e premi **Import backup**.
   Se hai effettuato l'accesso, i mazzi vengono copiati direttamente su
   Supabase; altrimenti sono salvati in questo browser e puoi usare **Copy
   local decks** dopo la registrazione.
3. Controlla che il numero e i nomi dei mazzi corrispondano. Puoi ripetere
   l'importazione: gli ID già copiati vengono saltati e i mazzi esistenti
   restano invariati. Il file e i mazzi sul vecchio sito non vengono cancellati.

Se il vecchio deploy non mostra **Download browser decks**, aggiorna il deploy
Render oppure usa **Share** su ogni mazzo e incolla i link in **Import Deck** sul
nuovo sito. I link singoli trasferiscono le carte, non gli sfondi personali.

Senza le due variabili Supabase, l'app continua a salvare i mazzi nel browser.
Con un account attivo, i nuovi mazzi vengono salvati sul cloud. Le partite in
corso continuano a usare Redis per lo stato temporaneo della stanza.

## Modello dati

`decks` contiene un record per mazzo: ID UUID, proprietario (`owner_id`), nome,
fazione, protagonista, composizione (`content`), eventuale percorso dello
sfondo, visibilità e date. `content_version` rende esplicito il formato della
composizione; `content` è JSONB con `persona` (ID di carte in ordine) e `deck`
(ID e quantità). Un mazzo viene quindi scritto con **una sola operazione
atomica**, senza lasciare una lista di carte incompleta durante le modifiche.
Gli ID delle carte sono stabili e non contengono URL di immagini.
`revision` impedisce di sovrascrivere senza avviso modifiche fatte su un altro
dispositivo: in caso di conflitto, l'editor chiede di ricaricare.

I mazzi nascono `private`. Le policy RLS consentono al proprietario di
leggerli e modificarli; chiunque può leggere solo quelli `public`. La data
`published_at` è controllata dal trigger. Da **My decks**, il proprietario può
usare **Publish** e **Unpublish**. Le modifiche salvate a un mazzo pubblico
sono subito visibili. **Public decks** permette ricerca per nome, filtro per
cronaca, paginazione, anteprima delle carte e importazione come copia privata.
Gli ospiti importano sul dispositivo; gli utenti connessi nel proprio account.
Gli sfondi personalizzati non sono copiati. Un mazzo ritirato non può più essere
importato, ma le copie già create restano ai rispettivi giocatori.
Per cercare mazzi che contengono una determinata carta su
grandi volumi si potrà aggiungere un indice derivato (`deck_cards_index`) dai
JSONB, senza modificare i record esistenti.

### Profili pubblici e aggiornamento di un database esistente

Applica nel SQL Editor soltanto le migrazioni mancanti, in ordine numerico,
prima di distribuire il nuovo frontend.

La seconda migrazione crea `player_profiles`, popola gli utenti esistenti e
mantiene i campi sincronizzati con un trigger su `auth.users`. Espone soltanto
nome, avatar, bio, cronaca preferita e sito: nessuna email o dato di sessione.
Il browser può leggere ma non scrivere direttamente questa tabella; l'editor
continua a salvare attraverso `auth.updateUser` e il trigger aggiorna la
proiezione pubblica nella stessa transazione. La policy RLS consente la lettura
del proprio profilo, di un autore con almeno un mazzo pubblico o di un giocatore
che ha commentato un mazzo pubblico. Se non restano mazzi o commenti pubblici,
il profilo non è più consultabile dagli altri.

Il nome dell'autore in **Public decks** apre `/players/:playerId`, con profilo
e soli mazzi pubblicati da quel giocatore. `/profile` resta la pagina personale
con il comando per modificare bio, preferenze e link.

La migrazione corregge anche la policy di lettura degli sfondi pubblici,
qualificando il percorso dell'oggetto nella sottoquery: lo sfondo diventa
leggibile quando il mazzo è pubblico e torna privato al ritiro. Gli URL firmati
già emessi restano validi fino alla loro scadenza.

Test delle migrazioni e delle policy su Postgres isolato, senza accesso al
progetto Supabase (PowerShell):

```powershell
$env:PUBLIC_DECKS_TEST_RUNTIME = Join-Path $env:TEMP 'astralia-public-decks-tests'
npm install --prefix $env:PUBLIC_DECKS_TEST_RUNTIME --no-save --ignore-scripts @electric-sql/pglite
node supabase/tests/publicDecks.test.mjs
```

Il test esegue le migrazioni di mazzi, profili e commenti e verifica pubblicazione, visibilità dei
profili, sincronizzazione dei campi, accesso agli sfondi, proprietà dei mazzi,
conflitti di revisione, commenti, risposte e conservazione delle copie dopo il ritiro.

### Descrizioni e commenti

`decks.description` contiene fino a 5000 caratteri di testo semplice. Si modifica
nell'editor anche per mazzi privati o salvati nel browser, oppure nel dialogo di
pubblicazione. Descrizione e pubblicazione vengono salvate insieme, con controllo
della revisione. I backup e l'importazione dei mazzi pubblici mantengono la
descrizione; i link nel formato del sito ufficiale continuano a trasferire le carte.

`deck_comments` contiene autore, mazzo, testo (1–2000 caratteri), data generata dal
server e riferimento opzionale al commento a cui si risponde. Tutti possono leggere
le discussioni dei mazzi pubblici; solo gli utenti autenticati possono scrivere, con
la propria identità. Le risposte devono riferirsi a un commento esistente dello
stesso mazzo. Ogni autore può modificare il testo o eliminare i propri commenti
e risposte sui mazzi pubblici. Se un commento viene eliminato, le sue risposte
dirette restano nella discussione come commenti di primo livello. Il testo è
sempre mostrato come testo semplice.

I commenti mostrano nome e avatar aggiornati del giocatore e un collegamento al
profilo. Il creatore del mazzo ha un'etichetta dedicata. Le discussioni vengono
caricate in pagine da 50 commenti, con risposte raggruppate e pulsante **Refresh**.
I tentativi ripetuti dello stesso invio riutilizzano l'ID per evitare duplicati in
caso di risposta persa. Ritirare un mazzo nasconde la discussione e blocca nuovi
commenti, mantenendola disponibile se il mazzo viene ripubblicato. Eliminare il
mazzo elimina anche la sua discussione. Le copie importate non ereditano i commenti.

Gli sfondi scelti dagli utenti vivono nel bucket privato `deck-backgrounds`,
con percorso `userId/deckId/file`. Le policy permettono al proprietario di
caricarli e cancellarli; lo sfondo di un mazzo pubblicato può essere letto
anche dai visitatori. L'app crea URL temporanei per mostrarli. Il bucket non
contiene immagini delle carte.

## Amministratori e dashboard di monitoring

La migrazione `supabase/migrations/202611190001_admin_monitoring.sql` aggiunge
ruoli admin, registro delle modifiche ai ruoli e statistiche. Applica anche
`supabase/migrations/202611190002_backend_admin_roles.sql`, che consente di
assegnare il ruolo solo dal backend. Se hai già applicato la prima versione,
esegui solo la seconda: rimuove l'attivazione con codice e conserva gli admin
esistenti. Applica le migrazioni dopo le tre precedenti, prima del frontend.
Non richiede nuove chiavi segrete nel frontend o modifiche al provider Discord.

### Assegnare il proprio account dal backend

1. Applica le migrazioni mancanti in ordine numerico nel SQL Editor di Supabase.
2. In **Authentication → Users**, individua il tuo account Discord e copia il
   suo **User UID** (UUID Supabase, non l'ID numerico Discord).
3. Nel SQL Editor, sostituisci il segnaposto con quel valore ed esegui:

   ```sql
   select public.set_site_admin('IL_TUO_USER_UID_SUPABASE'::uuid, true);
   ```

4. Ricarica il sito mentre sei connesso al tuo account. Il collegamento
   **Admin dashboard** compare direttamente sopra la sezione del profilo Discord,
   anche su mobile. Gli altri utenti non lo vedono e non possono accedere a `/admin`.

Non esistono codici di attivazione, moduli o comandi per promuovere un utente dal
frontend. Anche un account admin può solo leggere la directory utenti e il
monitoring: `set_site_admin` non è eseguibile con un token del browser, compresi
quelli degli admin. I privilegi dipendono da `public.site_admins`, non dai metadati
modificabili del profilo. L'assegnazione tramite la funzione registra un evento
**Backend** nell'audit. Puoi verificarla nel SQL Editor:

```sql
select user_id, granted_at from public.site_admins;
```

Per una futura revoca usa la stessa funzione dal backend con `false`; non è
possibile rimuovere l'ultimo admin con questa funzione. Non viene scelto un admin
automaticamente in base all'ordine di registrazione o al nome del profilo.

### Statistiche disponibili

- Presenze negli ultimi 5 minuti, con distinzione degli utenti autenticati.
- Visitatori unici, account unici, visite e pagine viste in un intervallo
  personalizzato fino a 366 giorni; scorciatoie 7/30/90 giorni.
- Confronto con il periodo precedente della stessa durata, grafico giornaliero,
  tabella accessibile ed esportazione CSV dei dati giornalieri.
- Tempo di coinvolgimento medio per visita e percentuale di visite coinvolte.
- Pagine più viste, provenienze per hostname e dispositivi indicativi.
- Account registrati, nuove iscrizioni, utenti attivi giornalieri/settimanali/
  mensili, mazzi cloud totali/pubblici/privati, nuovi mazzi e nuovi commenti.
- Distribuzione dei mazzi per cronaca, ricerca paginata degli utenti in sola lettura e ultime
  20 modifiche ai privilegi amministrativi.

Le date dei report e i raggruppamenti giornalieri sono **UTC**. Il giorno finale
scelto nell'interfaccia è incluso; l'API riceve il limite finale esclusivo.
Le presenze, DAU/WAU/MAU e i totali complessivi sono indicati esplicitamente come
indipendenti dall'intervallo selezionato. DAU indica oggi, WAU oggi e i 6 giorni
precedenti, MAU oggi e i 29 giorni precedenti.

### Raccolta e interpretazione

La raccolta del traffico inizia soltanto dopo **Allow statistics**. È possibile
modificare la scelta da **Settings → Usage statistics**; con Do Not Track o Global
Privacy Control la raccolta resta disabilitata. Il codice conserva un ID casuale
del browser in localStorage e una sessione in sessionStorage. Nessun IP, user
agent completo, email, testo, parametro URL, ID di mazzo o codice di stanza viene
inviato. I percorsi dinamici sono normalizzati (`/players/:id`, `/lobby`, `/game`);
le pagine admin e profilo sono escluse. Le visite autenticate sono collegate
all'ID account, derivato dal token sul database, mai dichiarato dal client.

I browser anonimi non equivalgono a persone: dispositivi/browser differenti,
cancellazione dei dati o accesso all'account dopo una visita anonima possono
produrre più visitatori per la stessa persona. Gli account unici sono invece
deduplicati per ID Supabase nell'intero intervallo. Non sommare gli unici
giornalieri per ottenere gli unici del periodo.

Una visita riparte dopo 30 minuti senza rilevazioni o al cambio di account.
Il browser invia una rilevazione ogni 30 secondi solo se la pagina è visibile,
ha il focus e ha ricevuto un'interazione negli ultimi 5 minuti. Il database
impone orari propri e limita il tempo dichiarato all'intervallo trascorso.
Una visita è considerata coinvolta se registra almeno 10 secondi o 2 pagine
nell'intervallo. Il tempo è una stima campionata: le visite brevi possono registrare
zero secondi. Gli eventi di navigazione sono dati dichiarati dal browser e non
una misura certificata o un audit delle azioni degli utenti.

Le statistiche di traffico coprono soltanto chi acconsente e non possono essere
ricostruite retroattivamente. Le iscrizioni e i conteggi dei contenuti interrogano
invece i dati esistenti senza dipendere dal consenso alla telemetria. Mazzi e
commenti cancellati non figurano nei conteggi correnti o storici dei contenuti;
i mazzi locali al browser non figurano nei totali cloud.

Solo RPC protette leggono aggregati e liste utenti. Le tabelle dei ruoli,
della telemetria e dell'audit non sono direttamente accessibili,
neppure agli admin tramite Data API. Le funzioni `security definer` hanno
`search_path` fisso e verificano il ruolo nel database a ogni operazione.
Modificare `user_metadata` o nascondere/mostrare un collegamento non dà permessi.
Un admin può consultare il monitoring; i ruoli si modificano solo dal backend. Questa migrazione non
gli assegna la modifica dei mazzi privati o dei profili degli altri giocatori.

Per limitare la conservazione a 395 giorni, pianifica giornalmente la funzione
`public.prune_site_analytics()` tramite il scheduler del database. Con l'estensione
**pg_cron** abilitata, esegui una volta nel SQL Editor:

```sql
select cron.schedule(
  'prune-site-analytics', '20 3 * * *',
  'select public.prune_site_analytics();'
);
```

Il codice applicativo non esegue la pulizia nelle richieste pubbliche; senza
scheduler la conservazione non è limitata automaticamente. La funzione elimina
solo telemetria scaduta, mai account, mazzi o audit dei ruoli.

Fonti usate per scegliere le metriche (le definizioni specifiche di questa
implementazione sono quelle sopra):
[Plausible, metriche](https://plausible.io/docs/metrics-definitions) e
[Google Analytics, coinvolgimento](https://support.google.com/analytics/answer/11109416).

Verifica isolata di assegnazione dal backend, accesso, revoca immediata dei privilegi API,
protezione dell'ultimo admin, privacy e aggregazioni (runtime già installato):

```powershell
$env:PUBLIC_DECKS_TEST_RUNTIME = Join-Path $env:TEMP 'astralia-public-decks-tests'
node --test supabase/tests/adminMonitoring.test.mjs supabase/tests/publicDecks.test.mjs
```

La verifica browser è in `client/tests/adminDashboard.test.mjs`. Usa API simulate
e non scrive nel database remoto. Con `playwright-core` in un runtime temporaneo,
Edge installato e l'anteprima locale avviata:

```powershell
$env:ADMIN_UI_TEST_RUNTIME = Join-Path $env:TEMP 'astralia-admin-ui-tests'
npm install --prefix $env:ADMIN_UI_TEST_RUNTIME --no-save --ignore-scripts playwright-core
# In un altro terminale: npm --prefix client run preview -- --host 127.0.0.1 --port 4173
$env:ADMIN_UI_BASE_URL = 'http://127.0.0.1:4173'
node --env-file=client/.env.local client/tests/adminDashboard.test.mjs
```

`ADMIN_UI_BROWSER` permette di indicare un eseguibile Chromium alternativo.
I test verificano accesso, assenza dei moduli di attivazione e dei comandi di ruolo,
posizione del collegamento dashboard, filtri, CSV, layout mobile e consenso.
Le schermate di verifica nel runtime temporaneo contengono esclusivamente dati
simulati; l'applicazione usa solo gli aggregati restituiti da Supabase.

## Immagini delle carte su Cloudflare

La funzione che costruisce gli URL è in `client/src/services/cardImageService.ts`.
La build di produzione usa il Worker configurato in `client/.env.production`.
I file WebP seguono il percorso `/cards/{faction}/{imageId}-{thumb|full}.webp`.
I Frammenti usano la cartella `neutral`.

1. Esegui `npm run cards:r2:upload` per caricare gli stessi file mantenendo il
   percorso `cards/...` nel bucket `astralia-card-images`.
2. Distribuisci il Worker in `cloudflare/card-images`, che legge il bucket con
   un binding R2 e serve le immagini sul suo URL `workers.dev`. Il bucket può
   restare privato. Dalla cartella del Worker esegui `npx wrangler login` e
   `npm run deploy`, poi prova un URL `/cards/...`. In seguito puoi assegnare
   al Worker un dominio tuo.
3. Per un ambiente con un Worker diverso, imposta `VITE_CARD_IMAGE_BASE_URL`
   al suo URL, senza `/cards` finale.
4. Verifica miniature e immagini complete in editor, lobby e partita; poi
   distribuisci la nuova build. I mazzi nel database non richiedono migrazione.

Se in futuro il catalogo non userà più nomi file prevedibili, aggiungi una
tabella `card_assets` con chiave `(card_id, variant)` e percorso R2, oppure un
manifest versionato. Mantieni nel mazzo soltanto gli ID delle carte.

## Verifica dei permessi prima del lancio

Con due account diversi, verifica che il secondo non possa leggere,
modificare o cancellare un mazzo privato del primo, neppure chiamando l'API
direttamente. Verifica inoltre che ripetere **Copy local decks** non crei
duplicati e che lo sfondo di un mazzo privato non sia accessibile da un altro
account. Il progetto non contiene credenziali Supabase, quindi questi controlli
richiedono un'istanza configurata.
