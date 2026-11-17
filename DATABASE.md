# Mazzi persistenti e immagini

## Configurazione

1. Crea un progetto Supabase. In **SQL Editor**, esegui
   `supabase/migrations/202611170001_decks.sql`. La migrazione crea tabella,
   indici, trigger, regole RLS e bucket privato per gli sfondi.
2. In **Authentication → Providers**, abilita Email. Configura l'URL del sito
   e gli URL di redirect per il dominio Vercel, compresi eventuali domini di
   preview. Se lasci attiva la conferma email, i nuovi account devono
   confermare il messaggio ricevuto prima di accedere.
3. In Vercel, imposta `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` per gli ambienti appropriati e ricompila il
   frontend. Per lo sviluppo locale, inseriscile in `client/.env.local`.
   La chiave pubblicabile è destinata al browser. Non usare una secret key o
   `service_role` con prefisso `VITE_`.
4. Apri **My Decks**, crea un account, salva un mazzo, esci e rientra.
   Prova anche da un altro browser. Per i mazzi precedenti usa **Copy local
   decks**: l'operazione è ripetibile e conserva gli originali sul dispositivo.

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
