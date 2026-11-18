# Astralia Chronicles Card Game App (Fan-Made)
**Disclaimer:** Questo progetto è **fan-made**, **non affiliato ufficialmente** con Astralia Chronicles e **non è a scopo di lucro**. Tutti i loghi, immagini e nomi appartengono ai rispettivi proprietari.

## Descrizione
Applicazione web per creare, visualizzare e gestire mazzi di carte. Progetto pensato per scopi di apprendimento e divertimento.

L'elenco delle funzionalità attuali è in [FEATURES.md](FEATURES.md).

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

La sezione **Multiplayer** nel menu laterale permette di creare stanze pubbliche
o private. Le stanze pubbliche mostrano nome della stanza, host, posti occupati
e spettatori; chiunque può unirsi come giocatore (se c'è un posto libero) o
spettatore. L'elenco si aggiorna ogni cinque secondi e permette di cercare per
stanza o host e filtrare per posti liberi o partite in corso.

Le stanze private, incluse quelle create prima di questa funzione, non compaiono
nell'elenco: giocatori e spettatori accedono con un codice di sei caratteri.
Entrambi i giocatori scelgono un mazzo salvato, locale o del proprio account.
Solo l'host può avviare la partita, dopo che entrambi sono connessi e hanno
selezionato il mazzo. Le partite già avviate accettano soltanto nuovi spettatori.

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

Apri `http://localhost:5173/multiplayer`, scegli **Create room**, una stanza
pubblica oppure **Join with code**. Per un hosting pubblico è sufficiente pubblicare il
server `server/` su un servizio Node/WebSocket e impostare nel client:

```bash
VITE_SERVER_URL=https://tuo-server.example.com
```

In sviluppo, senza Redis, il server mantiene le lobby in memoria. Il deploy
completo su Vercel usa Redis condiviso per conservare le partite tra istanze
e riavvii. Configurazione e verifiche sono in [DEPLOYMENT.md](DEPLOYMENT.md).

## Struttura del codice

- `client/src/pages/onlineGame/` contiene modello della tabella, componenti della partita e gestione delle scorciatoie. `OnlineGamePage.tsx` coordina connessione, stato e interazioni.
- `client/src/hooks/useDeckEditor.ts` gestisce il caricamento, la modifica e il salvataggio dei mazzi; `OpeningHandSimulator.tsx` gestisce la simulazione della mano.
- `client/src/domain/` contiene le regole del deck builder; `client/src/services/` contiene persistenza, dati delle carte e connessione Socket.IO.
- `server/gameTable.js` gestisce le operazioni sulle carte, `roomState.js` costruisce lo stato visibile ai client, `registerCardEvents.js` e `registerDeckEvents.js` registrano gli eventi della partita. `roomCommands.js` coordina le regole, `roomStore.js` e `redisBackend.js` salvano e distribuiscono gli aggiornamenti; `createGameServer.js` gestisce connessioni e recupero delle sessioni. `server.js` avvia il server locale e `api/game.js` lo espone su Vercel.

Verifiche disponibili: `npm --prefix client run build`, `npm --prefix client run lint`, `node client/tests/deckLinks.test.mjs` e `npm --prefix server test`.

## Contributi
Progetto open-source, contribuzioni benvenute.
