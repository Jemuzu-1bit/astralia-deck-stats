import { Link } from "react-router-dom";
import styles from "./HelpPage.module.scss";

export default function HelpPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link to="/" className={styles.backLink}>← Home</Link>
      <span>Guida rapida</span>
    </header>

    <main className={styles.content}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Astralia Deck Stats</span>
        <h1>Dal mazzo alla partita</h1>
        <p>Crea il tuo mazzo, condividi il codice della lobby e gioca su un tavolo virtuale. Bastano tre passi per iniziare.</p>
        <Link to="/my-decks" className={styles.primaryLink}>Prepara un mazzo →</Link>
      </section>

      <section aria-labelledby="getting-started">
        <h2 id="getting-started">Inizia in 3 passi</h2>
        <ol className={styles.steps}>
          <li><span className={styles.number}>1</span><h3>Prepara il mazzo</h3><p>Apri <strong>My Decks</strong> e aggiungi un mazzo, oppure usa <strong>Import Deck</strong> per incollare un link. I mazzi vengono salvati in questo browser.</p></li>
          <li><span className={styles.number}>2</span><h3>Entra in partita</h3><p>Dalla home scegli <strong>host game</strong> per creare una lobby o <strong>join game</strong> per entrare con il codice ricevuto.</p></li>
          <li><span className={styles.number}>3</span><h3>Scegli e avvia</h3><p>Entrambi i giocatori selezionano il proprio mazzo nella lobby. Quando sono pronti, chi ospita preme <strong>Start match</strong>.</p></li>
        </ol>
      </section>

      <section aria-labelledby="spectators-guide">
        <h2 id="spectators-guide">Guarda una partita</h2>
        <p>Dalla home scegli <strong>watch game</strong> e inserisci il codice della lobby. Puoi entrare prima o durante la partita, vedere il campo e le carte rivelate. Mani e mazzi restano privati e gli spettatori non possono modificare il tavolo.</p>
      </section>

      <section aria-labelledby="table-guide">
        <h2 id="table-guide">Sul tavolo</h2>
        <p className={styles.intro}>Il simulatore è manuale: ti aiuta a gestire carte e segnalini, mentre i giocatori applicano le regole della partita.</p>
        <div className={styles.commands}>
          <article><h3>🃏 Sposta le carte</h3><p>La mano è in basso. Trascina una carta nella zona desiderata oppure fai clic destro sulla carta e scegli la destinazione dal menu.</p></article>
          <article><h3>📚 Usa il mazzo</h3><p>Un clic sul tuo mazzo pesca una carta. Con il clic destro puoi mescolare, pescare o scartare più carte, guardare le prime carte e cercare nel mazzo.</p></article>
          <article><h3>👁️ Guarda le carte</h3><p>Quando guardi le prime carte, vedi tutto il mazzo in ordine: solo quelle guardate sono a faccia in su. Puoi spostarle sopra o sotto trascinandole o usando il menu.</p></article>
          <article><h3>🔢 Gestisci i segnalini</h3><p>Il clic sinistro aumenta Frazzle, ATK, HP e counter; il clic destro li diminuisce. Dal menu della carta puoi aggiungere, scegliere o rimuovere counter personalizzati.</p></article>
          <article><h3>🤝 Azioni dell'avversario</h3><p>Con il clic destro sul mazzo avversario puoi chiedergli di eseguire un'azione. L'altro giocatore deve accettare la richiesta prima che venga eseguita.</p></article>
          <article><h3>↩️ Torna alla mano</h3><p>Quando apri un'altra zona, le sue carte prendono il posto della mano nella barra in basso. Premi <strong>← Hand</strong> per tornare alle tue carte.</p></article>
        </div>
      </section>

      <div className={styles.footer}>
        <p>Pronto a giocare?</p>
        <Link to="/" className={styles.primaryLink}>Vai alla home →</Link>
      </div>
    </main>
  </div>;
}
