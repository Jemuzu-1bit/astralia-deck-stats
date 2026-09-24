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

Per ora i pulsanti online sono nascosti dalla home. Sono disponibili usando
il link riservato:

```text
https://tuo-sito.example.com/?online=1
```

Per mostrarli nuovamente a tutti, imposta `VITE_ENABLE_ONLINE_MENU=true` nelle
variabili d'ambiente del frontend e avvia un nuovo deploy.

## Contributi
Progetto open-source, contribuzioni benvenute.
