import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import ArchiveIcon from "./ArchiveIcon";
import SettingsMenu from "./SettingsMenu";
import ShortcutSettings from "./ShortcutSettings";
import FeedbackLink from "./FeedbackLink";
import DiscordProfile from "./DiscordProfile";
import useAuthSession from "../hooks/useAuthSession";
import useAdminAccess from "../hooks/useAdminAccess";
import { takeDiscordAppearanceDraft } from "../services/discordAppearanceService";
import { gameConnection } from "../services/gameConnection";
import styles from "./ArchiveLayout.module.scss";

const subscribeToLobby = (onChange: () => void) => gameConnection.onState(onChange);

function getLobbyPath() {
  const { code, viewerRole, started } = gameConnection.getCurrentState();
  if (!code || !viewerRole || started) return null;
  return `/lobby/${code}${viewerRole === "spectator" ? "?watch=1" : ""}`;
}

export default function ArchiveLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const authSession = useAuthSession();
  const lobbyPath = useSyncExternalStore(subscribeToLobby, getLobbyPath);
  const userId = authSession.user?.id;
  useEffect(() => {
    if (!authSession.authReady || location.pathname !== "/my-decks") return;
    const reconnect = takeDiscordAppearanceDraft(userId);
    if (reconnect) navigate("/profile/edit", { replace: true, state: { ...reconnect, syncDiscord: true } });
  }, [authSession.authReady, location.pathname, navigate, userId]);
  const adminAccess = useAdminAccess(authSession.user?.id);
  const [settings, setSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const title = location.pathname === "/admin" ? "Admin dashboard" : location.pathname === "/multiplayer" ? "Multiplayer" : location.pathname.startsWith("/lobby") ? "Match lobby" : location.pathname === "/public-decks" ? "Public decks" : location.pathname.startsWith("/players/") ? "Player profile" : location.pathname === "/profile/edit" ? "Edit profile" : location.pathname === "/profile" ? "My profile" : location.pathname === "/my-decks" ? "My decks" : location.pathname === "/cards" ? "Card library" : location.pathname === "/help" ? "Getting started" : "Overview";
  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <div className={styles.sidebarNavigation}>
      <Link to="/" className={styles.brand}><span className={styles.brandMark}>A<span>✦</span></span><span>ASTRALIA<small>DECK ARCHIVE</small></span></Link>
      <Link to="/my-decks?new=1" className={styles.create}><ArchiveIcon name="plus" /> New deck</Link>
      <span className={styles.caption}>YOUR WORKSPACE</span>
      <nav className={styles.nav} aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="home" /><span>Overview</span></NavLink>
        <NavLink to="/my-decks" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="decks" /><span>My decks</span></NavLink>
        <NavLink to="/public-decks" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="user" /><span>Public decks</span></NavLink>
        <NavLink to="/cards" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="cards" /><span>Card library</span></NavLink>
        <div className={lobbyPath ? styles.multiplayerWithLobby : undefined}>
          <NavLink to="/multiplayer" className={({ isActive }) => isActive || location.pathname.startsWith("/lobby") ? styles.active : undefined}><ArchiveIcon name="multiplayer" /><span>Multiplayer</span></NavLink>
          {lobbyPath && <NavLink to={lobbyPath} end className={styles.backToLobby}><ArchiveIcon name="return" size={16} /><span>Back to Lobby</span></NavLink>}
        </div>
        <NavLink to="/help" className={({ isActive }) => isActive ? styles.active : undefined}><ArchiveIcon name="book" /><span>Getting started</span></NavLink>
      </nav>
      </div>
      <DiscordProfile {...authSession} isAdmin={adminAccess.isAdmin} onSettings={() => setSettings(true)} />
      <div className={styles.sidebarBottom}>
        {!authSession.user && <button onClick={() => setSettings(true)}><ArchiveIcon name="settings" /> Settings</button>}
        <FeedbackLink>Send feedback ↗</FeedbackLink>
        <p>Made for your next great deck.</p>
      </div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><span>Astralia <span className={styles.slash}>/</span> <strong>{title}</strong></span><Link to="/cards" className={styles.search}><ArchiveIcon name="search" size={16} /><span>Find a card…</span></Link></header>
      <main className={styles.content}><Outlet context={{ ...authSession, ...adminAccess }} /></main>
      <footer className={styles.footer}><span>ASTRALIA <span>DECK ARCHIVE</span></span><Link to="/help">Build. Refine. Play.</Link></footer>
    </div>
    {settings && <SettingsMenu onClose={() => setSettings(false)} onShortcuts={() => { setSettings(false); setShortcuts(true); }} />}
    {shortcuts && <ShortcutSettings onClose={() => setShortcuts(false)} />}
  </div>;
}
