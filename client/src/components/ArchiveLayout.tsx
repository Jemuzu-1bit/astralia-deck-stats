import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import ArchiveIcon from "./ArchiveIcon";
import SettingsMenu from "./SettingsMenu";
import ShortcutSettings from "./ShortcutSettings";
import FeedbackLink from "./FeedbackLink";
import styles from "./ArchiveLayout.module.scss";

export default function ArchiveLayout() {
  const location = useLocation();
  const [settings, setSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const title = location.pathname === "/my-decks" ? "My decks" : location.pathname === "/cards" ? "Card library" : location.pathname === "/help" ? "How to play" : "Overview";
  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.brand}><span className={styles.brandMark}>A<span>✦</span></span><span>ASTRALIA<small>DECK ARCHIVE</small></span></Link>
      <Link to="/my-decks?new=1" className={styles.create}><ArchiveIcon name="plus" /> New deck</Link>
      <span className={styles.caption}>YOUR WORKSPACE</span>
      <nav className={styles.nav} aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="home" /><span>Overview</span></NavLink>
        <NavLink to="/my-decks" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="decks" /><span>My decks</span></NavLink>
        <NavLink to="/cards" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="cards" /><span>Card library</span></NavLink>
        <NavLink to="/help" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="book" /><span>How to play</span></NavLink>
      </nav>
      <div className={styles.sidebarBottom}>
        <button onClick={() => setSettings(true)}><ArchiveIcon name="settings" /> Settings</button>
        <FeedbackLink>Send feedback ↗</FeedbackLink>
        <p>Made for your next great deck.</p>
      </div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><span>Astralia <span className={styles.slash}>/</span> <strong>{title}</strong></span><Link to="/cards" className={styles.search}><ArchiveIcon name="search" size={16} /><span>Find a card…</span></Link></header>
      <main className={styles.content}><Outlet /></main>
      <footer className={styles.footer}><span>ASTRALIA <span>DECK ARCHIVE</span></span><Link to="/help">Build. Refine. Play.</Link></footer>
    </div>
    {settings && <SettingsMenu onClose={() => setSettings(false)} onShortcuts={() => { setSettings(false); setShortcuts(true); }} />}
    {shortcuts && <ShortcutSettings onClose={() => setShortcuts(false)} />}
  </div>;
}
