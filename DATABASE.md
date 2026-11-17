# Mazzi persistenti e immagini

## Configurazione

1. Crea un progetto Supabase. In **SQL Editor**, esegui
   `supabase/migrations/202611170001_decks.sql`. La migrazione crea tabella,
   indici, trigger, regole RLS e bucket privato per gli sfondi.
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
`published_at` è controllata dal trigger. L'interfaccia per pubblicare e
sfogliare i mazzi non è ancora presente: in futuro potrà cambiare
`visibility` e interrogare l'indice `decks_public_recent_idx` senza cambiare il
formato dei mazzi. Per cercare mazzi che contengono una determinata carta su
grandi volumi si potrà aggiungere un indice derivato (`deck_cards_index`) dai
JSONB, senza modificare i record esistenti.

Gli sfondi scelti dagli utenti vivono nel bucket privato `deck-backgrounds`,
con percorso `userId/deckId/file`. Le policy permettono al proprietario di
caricarli e cancellarli; lo sfondo di un mazzo pubblicato può essere letto
anche dai visitatori. L'app crea URL temporanei per mostrarli. Il bucket non
contiene immagini delle carte.

## Immagini delle carte su Cloudflare

La funzione che costruisce gli URL è in `client/src/services/cardImageService.ts`.
Oggi usa `/cards/{faction}/{imageId}-{thumb|full}.webp` sul dominio del sito.
Quando le immagini saranno su Cloudflare R2:

1. Carica gli stessi file mantenendo il percorso `cards/...` e abilita un
   dominio pubblico personalizzato per il bucket.
2. Imposta `VITE_CARD_IMAGE_BASE_URL` al dominio, per esempio
   `https://cards.example.com`, senza `/cards` finale.
3. Verifica miniature e immagini complete in editor, lobby e partita; poi
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
