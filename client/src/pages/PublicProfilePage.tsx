import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import type { PublicProfile } from "../domain/publicDecks";
import { getPublicProfile } from "../services/publicDeckService";
import PlayerAvatar from "../components/PlayerAvatar";
import PublicDeckCollection from "../components/PublicDeckCollection";
import { CHRONICLES } from "../data/chronicles";
import styles from "./ProfilePage.module.scss";

function PlayerProfile({ id }: { id: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getPublicProfile(id).then(result => { if (active) setProfile(result); })
      .catch(() => { if (active) setError("Could not load this player profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);
  const favorite = profile ? CHRONICLES[profile.favoriteChronicle] : null;
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>COMMUNITY PLAYER</span><h1>Player profile</h1></div><Link className={styles.secondary} to="/public-decks">Public decks</Link></header>
    {loading ? <p role="status">Loading player profile...</p> : error ? <div role="alert"><p className={styles.error}>{error}</p><button className={styles.secondary} onClick={() => setRetry(value => value + 1)}>Try again</button></div> : !profile ? <p>This profile is not available. The player may no longer have public decks or comments.</p> : <>
      <section className={styles.card} aria-label="Player profile"><div className={styles.cover} style={favorite ? { backgroundImage: `linear-gradient(0deg, #18191d, #18191d30), url(${favorite.image})` } : undefined} /><div className={styles.cardBody}>
        <PlayerAvatar name={profile.name} avatar={profile.avatar} className={styles.heroAvatar} />
        <span className={styles.eyebrow}>COMMUNITY PLAYER</span><h2>{profile.name}</h2><p className={styles.bio}>{profile.bio || "This player has not added a bio yet."}</p>
        <dl className={styles.facts}><div><dt>Favorite chronicle</dt><dd style={favorite ? { color: favorite.color } : undefined}>{favorite?.name || "No preference"}</dd></div>{profile.website && <div><dt>Website / social</dt><dd><a href={profile.website} target="_blank" rel="noopener noreferrer">{new URL(profile.website).hostname} ↗</a></dd></div>}</dl>
      </div></section>
      <PublicDeckCollection key={id} ownerId={id} />
    </>}
  </div>;
}

export default function PublicProfilePage() {
  const { playerId = "" } = useParams();
  const { authReady, user } = useOutletContext<AuthSession>();
  if (!authReady) return <div className={styles.page}><p role="status">Loading player profile...</p></div>;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)) return <div className={styles.page}><h1>Player not found</h1><Link to="/public-decks">Browse public decks</Link></div>;
  return <PlayerProfile key={`${playerId}:${user?.id ?? "guest"}`} id={playerId} />;
}
