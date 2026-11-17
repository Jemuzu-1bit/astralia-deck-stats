import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { getPlayerProfile, profileWebsite } from "../domain/playerProfile";
import { CHRONICLES } from "../data/chronicles";
import { FACTIONS } from "../domain/deckBuilder";
import { supabase } from "../services/supabaseClient";
import PlayerAvatar from "../components/PlayerAvatar";
import ArchiveIcon from "../components/ArchiveIcon";
import styles from "./ProfilePage.module.scss";

function ProfileEditor({ user }: { user: User }) {
  const profile = getPlayerProfile(user);
  const [bio, setBio] = useState(profile.bio);
  const [favoriteChronicle, setFavoriteChronicle] = useState(FACTIONS.some(faction => faction === profile.favoriteChronicle) ? profile.favoriteChronicle : "");
  const [website, setWebsite] = useState(profile.website);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: {
        player_profile: { bio: bio.trim(), favoriteChronicle, website: profileWebsite(website) },
      } });
      if (error) throw error;
      if (active.current) navigate("/profile", { replace: true, state: { profileSaved: true } });
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : "Could not save your profile. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  };

  return <form className={styles.editor} onSubmit={event => void save(event)} aria-busy={saving}>
    <div className={styles.discordIdentity}>
      <PlayerAvatar name={profile.name} avatar={profile.avatar} className={styles.avatar} />
      <div><strong>{profile.name}</strong><p>Your name and avatar come from Discord.</p></div>
    </div>
    <fieldset disabled={saving}>
      <label htmlFor="profile-bio">Bio</label>
      <textarea id="profile-bio" rows={4} maxLength={300} value={bio} onChange={event => setBio(event.target.value)} placeholder="Tell other players about your play style and favorite strategies." aria-describedby="profile-bio-count" />
      <span id="profile-bio-count" className={styles.hint}>{bio.length}/300 characters</span>
      <label htmlFor="profile-chronicle">Favorite chronicle</label>
      <select id="profile-chronicle" value={favoriteChronicle} onChange={event => setFavoriteChronicle(event.target.value)}>
        <option value="">No preference</option>
        {FACTIONS.map(faction => <option key={faction} value={faction}>{CHRONICLES[faction].name}</option>)}
      </select>
      <label htmlFor="profile-website">Website or social link</label>
      <input id="profile-website" type="url" maxLength={500} value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://" />
    </fieldset>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={saving} onClick={() => navigate("/profile")}>Cancel</button>
      <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
    </div>
  </form>;
}

export default function ProfilePage({ editing = false }: { editing?: boolean }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  const location = useLocation();
  if (!authReady) return <div className={styles.page}><p role="status">Loading profile...</p></div>;
  if (!user) return <div className={styles.page}><h1>Your player profile</h1><p className={styles.intro}>Sign in with Discord from the account section to view and edit your profile.</p><Link className={styles.secondary} to="/">Back to overview</Link></div>;

  const profile = getPlayerProfile(user);
  const favorite = FACTIONS.some(faction => faction === profile.favoriteChronicle) ? CHRONICLES[profile.favoriteChronicle] : null;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>YOUR PLAYER PROFILE</span><h1>{editing ? "Edit profile" : "My profile"}</h1><p className={styles.intro}>{editing ? "Tell your story in Astralia." : "Your identity in the Deck Archive."}</p></div>
      {!editing && <Link className={styles.primary} to="/profile/edit"><ArchiveIcon name="edit" size={16} /> Edit profile</Link>}
    </header>
    {editing ? <ProfileEditor key={user.id} user={user} /> : <>
      {location.state?.profileSaved && <p className={styles.success} role="status">Profile saved.</p>}
      <section className={styles.card} aria-label="Player profile">
        <div className={styles.cover} style={favorite ? { backgroundImage: `linear-gradient(0deg, #18191d, #18191d30), url(${favorite.image})` } : undefined} />
        <div className={styles.cardBody}>
          <PlayerAvatar name={profile.name} avatar={profile.avatar} className={styles.heroAvatar} />
          <span className={styles.eyebrow}>DISCORD PLAYER</span>
          <h2>{profile.name}</h2>
          <p className={styles.bio}>{profile.bio || "Your story starts here. Add a bio to introduce yourself."}</p>
          <dl className={styles.facts}><div><dt>Favorite chronicle</dt><dd style={favorite ? { color: favorite.color } : undefined}>{favorite?.name || "No preference"}</dd></div>
            {profile.website && <div><dt>Website / social</dt><dd><a href={profile.website} target="_blank" rel="noopener noreferrer">{new URL(profile.website).hostname}<ArchiveIcon name="arrow" size={14} /></a></dd></div>}
          </dl>
        </div>
      </section>
      <p className={styles.hint}>When you publish a deck or comment on a public deck, other players can see this profile and your published decks. <Link to={`/players/${user.id}`}>View public profile →</Link></p>
    </>}
  </div>;
}
