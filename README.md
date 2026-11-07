# Astralia Chronicles Card Game App (Fan-Made)
**Disclaimer:** Questo progetto è **fan-made**, **non affiliato ufficialmente** con Astralia Chronicles e **non è a scopo di lucro**. Tutti i loghi, immagini e nomi appartengono ai rispettivi proprietari.

## Descrizione
Applicazione web per creare, visualizzare e gestire mazzi di carte. Progetto pensato per scopi di apprendimento e divertimento.

## Come eseguire il progetto
### 1. Clona il repository
```bash
git clone https://github.com/TUO-USERNAME/astralia-card-app.git
cd astralia-card-app
```

### 2. Avvia il client
```bash
cd client
npm install
npm run dev
```

Apri il browser su `http://localhost:5173`.

## Partite online

Il progetto include una lobby Socket.IO a due giocatori derivata dal flusso
della repo originale: l'host crea una stanza, condivide il codice mostrato
nella lobby e il secondo giocatore lo usa per entrare. I mazzi vengono scelti
tra quelli già salvati nel deck builder locale; il deck builder non viene
modificato.

Avvio locale:

```bash
cd server
npm install
npm start

# in un altro terminale
cd client
npm install
npm run dev
```

Apri `http://localhost:5173`, scegli `host game` oppure `join game` e inserisci
il codice della lobby. Per un hosting pubblico è sufficiente pubblicare il
server `server/` su un servizio Node/WebSocket e impostare nel client:

```bash
VITE_SERVER_URL=https://tuo-server.example.com
```

Il server mantiene le lobby in memoria: il riavvio chiude le partite attive.

## Struttura del codice

- `client/src/pages/onlineGame/` contiene modello della tabella, componenti della partita e gestione delle scorciatoie. `OnlineGamePage.tsx` coordina connessione, stato e interazioni.
- `client/src/hooks/useDeckEditor.ts` gestisce il caricamento, la modifica e il salvataggio dei mazzi; `OpeningHandSimulator.tsx` gestisce la simulazione della mano.
- `client/src/domain/` contiene le regole del deck builder; `client/src/services/` contiene persistenza, dati delle carte e connessione Socket.IO.
- `server/gameTable.js` gestisce le operazioni sulle carte, `roomState.js` costruisce lo stato visibile ai client, `registerCardEvents.js` e `registerDeckEvents.js` registrano gli eventi della partita. `server.js` gestisce stanze, lobby e avvio del server.

Verifiche disponibili: `npm --prefix client run build`, `npm --prefix client run lint`, `node client/tests/deckLinks.test.mjs` e `npm --prefix server test`.

## Contributi
Progetto open-source, contribuzioni benvenute.
