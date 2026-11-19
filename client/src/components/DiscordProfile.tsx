import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { supabase } from "../services/supabaseClient";
import { getPlayerProfile } from "../domain/playerProfile";
import PlayerAvatar from "./PlayerAvatar";
import ArchiveIcon from "./ArchiveIcon";
import styles from "./DiscordProfile.module.scss";

export default function DiscordProfile({ user, authReady, authError, isAdmin = false, onSettings }: AuthSession & { isAdmin?: boolean; onSettings: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => { if (menu.current) menu.current.open = false; };
  if (!supabase) return null;

  const { name, avatar } = user ? getPlayerProfile(user) : { name: "", avatar: "" };

  const authenticate = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const result = user
        ? await supabase.auth.signOut()
        : await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: `${window.location.origin}/my-decks` },
        });
      if (result.error) setError(result.error.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not connect to your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <section className={styles.profile} aria-label="Discord profile" aria-busy={!authReady || busy}>
    {authReady && user && isAdmin && <NavLink to="/admin" className={({ isActive }) => `${styles.dashboard} ${isActive ? styles.dashboardActive : ""}`}><ArchiveIcon name="chart" size={18} /> Admin dashboard</NavLink>}
    {!authReady ? <p className={styles.hint} role="status">Loading account...</p> : user ? <details ref={menu} className={styles.accountMenu} onKeyDown={event => {
      if (event.key === "Escape") { closeMenu(); menu.current?.querySelector("summary")?.focus(); }
    }}>
      <summary className={styles.identity} aria-label={`Account menu for ${name}`}>
        <PlayerAvatar name={name} avatar={avatar} className={styles.avatar} />
        <span className={styles.details}><span>DISCORD PROFILE</span><strong title={name}>{name}</strong></span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </summary>
      <nav className={styles.menuItems} aria-label="Account">
        <Link to="/profile" onClick={closeMenu}><ArchiveIcon name="user" size={16} /> My profile</Link>
        <Link to="/profile/edit" onClick={closeMenu}><ArchiveIcon name="edit" size={16} /> Edit profile</Link>
        <button type="button" onClick={() => { closeMenu(); onSettings(); }}><ArchiveIcon name="settings" size={16} /> Settings</button>
        <button type="button" className={styles.signOut} disabled={busy} onClick={() => void authenticate()}><ArchiveIcon name="logout" size={16} />{busy ? "Signing out..." : "Sign out"}</button>
      </nav>
    </details> : <>
      <p className={styles.hint}>Sign in to save your decks online.</p>
      <button type="button" className={styles.signIn} disabled={busy} onClick={() => void authenticate()}>{busy ? "Connecting..." : "Continue with Discord"}</button>
    </>}
    {(error || authError) && <p className={styles.error} role="alert">{error || authError}</p>}
  </section>;
}
