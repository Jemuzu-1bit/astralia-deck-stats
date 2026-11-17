# Deploy completo su Vercel

Per account e mazzi persistenti, segui anche [DATABASE.md](DATABASE.md) e
configura le due variabili `VITE_SUPABASE_*` nella build Vercel.

Il frontend React/Vite e il server Socket.IO vengono pubblicati nello stesso
progetto Vercel. Il backend richiede un Redis esterno condiviso: salva le stanze
e distribuisce gli aggiornamenti tra le istanze. Componenti visivi e regole delle
carte restano gli stessi.

## Impostazioni del progetto

| Impostazione | Valore |
| --- | --- |
| Root Directory | Radice del repository (`.`), **non `client`** |
| Framework | Vite |
| Node.js | 24.x |
| Install Command | `npm ci && npm --prefix client ci` |
| Build Command | `npm run build:vercel` |
| Output Directory | `client/dist` |
| Production Branch | `main` |
| Fluid Compute | Abilitato |

I comandi e le route sono definiti in `vercel.json`. La Function `api/game.js`
esporta il server HTTP con Socket.IO e usa una durata massima di 300 secondi.
Alla chiusura di una connessione il client si riconnette, recupera la sessione e
riprende le azioni in attesa. Il limite non diventa un limite alla durata della
partita: lo stato rimane in Redis fino alla scadenza della stanza.

La build Vercel configura `/api/game/socket.io` come endpoint del client. La build
locale normale continua a usare `/socket.io`. Rimuovere l'eventuale vecchia
variabile `VITE_SERVER_URL` dalla configurazione Vercel: il server ora e' sullo
stesso dominio. Il comando di build segnala un errore se e' ancora impostata.

## Redis

Creare o collegare un servizio Redis che supporti connessioni TCP/TLS, `EVAL`,
`PUBLISH`/`SUBSCRIBE`, `GET`, `SET`, `DEL` e `SCAN`. Un endpoint solo REST non e'
sufficiente. Configurare persistenza e una policy senza eviction delle stanze
attive; il TTL applicativo rimuove le stanze scadute. Preferire la stessa area
geografica per Redis e la regione della Function, da impostare nel progetto.

Impostare nelle Environment Variables di Vercel, esclusivamente lato server:

| Variabile | Esempio |
| --- | --- |
| `REDIS_URL` | `rediss://default:PASSWORD@HOST:6379` |
| `REDIS_KEY_PREFIX` | `astralia:production` |

Non usare il prefisso `VITE_` per queste variabili: le credenziali Redis non
devono arrivare al browser. Il modello e' in `.env.example`; non commettere `.env`.
Vercel rifiuta l'avvio senza Redis, evitando un fallback involontario a stanze
locali a ciascuna Function.

Usare un database o un prefisso distinto per Production e Preview. Anche preview
di branch diversi devono avere namespace distinti se non devono condividere
stanze. Versioni compatibili dello stesso ambiente devono mantenere lo stesso
prefisso per poter riprendere le sessioni dopo un deploy. Il formato attuale
delle stanze va migrato esplicitamente se cambia in future versioni.

## Comportamento del backend

- Ogni comando lavora su una copia della stanza. Uno script Lua salva lo stato
  e pubblica gli eventi in un'unica operazione, solo se la versione letta non e'
  stata modificata nel frattempo. In caso di conflitto, il comando viene ricalcolato.
- Le proiezioni inviate a host, ospite e spettatori usano gli stessi filtri di
  `roomState.js`; lo stato completo e i token non vengono trasmessi agli altri utenti.
- Le azioni del client vengono inviate in ordine, con conferma e identificativo.
  Il backend riconosce gli ultimi 512 comandi della stanza per evitare duplicati
  durante le riconnessioni. La coda vive nella scheda: un ricaricamento completo
  non conserva azioni che non sono ancora state salvate sul server.
- Redis Pub/Sub distribuisce gli aggiornamenti. Le istanze con utenti connessi
  rileggono periodicamente lo stato per recuperare eventuali notifiche perse.
- I heartbeat rinnovano la presenza. Dopo una terminazione improvvisa, una
  presenza non rinnovata scade entro 90 secondi. Le stanze senza giocatori
  scadono dopo 30 minuti; gli spettatori da soli non le mantengono vive.
- Le frecce temporanee usano scadenze assolute. Un controllo periodico pulisce
  lo stato; la scadenza viene verificata anche alla successiva azione o riconnessione.
- Un riavvio della Function non elimina le partite. Redis deve invece restare
  disponibile e preservare i dati; durante un'interruzione le azioni attendono
  il recupero del collegamento.

## Avvio e verifiche locali

Il flusso esistente `npm --prefix server start` e `npm --prefix client run dev`
funziona senza Redis, usando memoria locale per sviluppo. Per usare Redis anche
localmente, impostare le due variabili nell'ambiente oppure, dalla radice:

```sh
node --env-file=.env server/server.js
```

Dopo aver installato le dipendenze con `npm ci`, `npm --prefix server ci` e
`npm --prefix client ci`, eseguire:

```sh
npm --prefix server test
node --test client/tests/gameConnection.test.mjs
node --test client/tests/deckLinks.test.mjs
npm run build:vercel
```

Il test Redis di `server/distributed.test.mjs` viene eseguito solo con
`TEST_REDIS_URL` impostata. Usa due connessioni indipendenti e un namespace
casuale dedicato, che ripulisce senza usare `FLUSHDB`. Esempio PowerShell per
un Redis locale gia' disponibile:

```powershell
$env:TEST_REDIS_URL = 'redis://127.0.0.1:6379'
node --test server/distributed.test.mjs
```

Prima del cambio dominio verificare nel deploy di preview: `/api/health`, apertura
diretta e refresh di `/my-decks`, lobby, partita a due browser, spettatore,
privacy delle mani e riconnessione dopo oltre cinque minuti.

Le stanze gia' presenti nella memoria del vecchio server Render non vengono
trasferite automaticamente: effettuare il passaggio quando non ci sono partite
attive. Conservare lo stesso dominio HTTPS per mantenere mazzi e preferenze
salvati nel `localStorage` dei browser.

Riferimenti: [WebSocket su Vercel](https://vercel.com/docs/functions/websockets),
[durata delle Functions](https://vercel.com/docs/functions/configuring-functions/duration).
