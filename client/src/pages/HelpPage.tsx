import { Link } from "react-router-dom";
import { SHORTCUT_LABELS, useGameShortcuts, type ShortcutScope } from "./gameShortcuts";
import styles from "./HelpPage.module.scss";

const shortcutSections: { scope: ShortcutScope; title: string }[] = [
  { scope: "card", title: "Cards" }, { scope: "deck", title: "Deck" },
  { scope: "fragment", title: "Fragments" }, { scope: "counter", title: "Counters" },
];

export default function HelpPage() {
  const shortcuts = useGameShortcuts();
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link to="/" className={styles.backLink}>← Home</Link>
      <span>Quick guide</span>
    </header>

    <main className={styles.content}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Astralia Deck Stats</span>
        <h1>Get ready to play</h1>
        <p>Build a deck, invite a friend, and play together online. You can get started in three simple steps.</p>
        <Link to="/my-decks" className={styles.primaryLink}>Build a deck →</Link>
      </section>

      <section aria-labelledby="getting-started">
        <h2 id="getting-started">Start in 3 steps</h2>
        <ol className={styles.steps}>
          <li><span className={styles.number}>1</span><h3>Get your deck ready</h3><p>Open <strong>My Decks</strong> to create a deck, or choose <strong>Import Deck</strong> to paste a deck link. Your decks are saved in this browser.</p></li>
          <li><span className={styles.number}>2</span><h3>Join a game</h3><p>On the home page, choose <strong>host game</strong> to create a lobby. If a friend sent you a code, choose <strong>join game</strong> and enter it.</p></li>
          <li><span className={styles.number}>3</span><h3>Pick your decks and start</h3><p>Each player chooses a deck in the lobby. Once both players are ready, the host selects <strong>Start match</strong>.</p></li>
        </ol>
      </section>

      <section aria-labelledby="spectators-guide">
        <h2 id="spectators-guide">Watch a game</h2>
        <p>Choose <strong>watch game</strong> on the home page and enter the lobby code. You can join before or during a match. You can see the table and revealed cards, but players' hands and decks stay private. Spectators cannot change the table.</p>
      </section>

      <section aria-labelledby="table-guide">
        <h2 id="table-guide">Using the game table</h2>
        <p className={styles.intro}>You move cards and markers yourself. The table helps you keep track of the game while you and your opponent follow the rules.</p>
        <div className={styles.commands}>
          <article><h3>🃏 Move cards</h3><p>Your hand is at the bottom of the screen. Drag a card where you want it, or right click it and choose a destination from the menu.</p></article>
          <article><h3>📚 Use your deck</h3><p>Click your deck to draw one card. Right click it to shuffle, draw or discard several cards, look at the top cards, or search your deck.</p></article>
          <article><h3>👁️ Look at cards</h3><p>When you look at the top cards, you can see your deck in order. Only the cards you chose to look at are face up. Drag cards to move them to the top or bottom, or use their menu.</p></article>
          <article><h3>⚔️ Attack</h3><p>Click near the top of your card on the table, then choose an opponent's card. If your card has Assault, it gets just 1 Frazzle when attacking.</p></article>
          <article><h3>🛡️ Block</h3><p>Click near the bottom of your card on the table, then choose the opponent's card to block. If your card has Guard, it gets no Frazzle when blocking.</p></article>
          <article><h3>🔢 Use counters and markers</h3><p>Left click a Frazzle, ATK, HP, or number counter to increase it; right click to decrease it. Use a card's menu to add status markers such as Barrier, Assault, or Guard. Each status marker can appear once; right click it to remove it.</p></article>
          <article><h3>🤝 Ask your opponent</h3><p>Right click your opponent's deck to request an action. They will need to accept before it happens.</p></article>
          <article><h3>↩️ Return to your hand</h3><p>When you open another area, its cards appear in the bar at the bottom. Select <strong>← Hand</strong> to see your hand again.</p></article>
        </div>
      </section>

      <section aria-labelledby="keyboard-guide">
        <h2 id="keyboard-guide">Keyboard shortcuts</h2>
        <p className={styles.intro}>Move your pointer over one of your cards, a deck, a counter, or the Fragment area, then press one key. Actions on your opponent's deck ask for their approval. You can change shortcuts from the home page or the match settings. Press Esc to cancel when choosing a target.</p>
        {shortcutSections.map(({ scope, title }) => <div key={scope}>
          <h3>{title}</h3>
          <dl className={styles.shortcuts}>{Object.entries(SHORTCUT_LABELS[scope]).map(([action, label]) => <div key={action}><dt><kbd>{(shortcuts[scope] as Record<string, string>)[action]}</kbd></dt><dd>{label}</dd></div>)}</dl>
        </div>)}
      </section>

      <div className={styles.footer}>
        <p>Ready to play?</p>
        <Link to="/" className={styles.primaryLink}>Go to home →</Link>
      </div>
    </main>
  </div>;
}
