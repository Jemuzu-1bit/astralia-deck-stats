import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import type { AuthSession } from "../hooks/useAuthSession";
import { applyDiscordCosmetics, availableDiscordCosmetics, getPlayerProfile, profileWebsite, readProfileAppearance, type ProfileAppearance } from "../domain/playerProfile";
import { safeProfileUrl } from "../domain/publicDecks";
import { ChronicleSelect } from "../components/ChronicleLabel";
import { FACTIONS } from "../domain/deckBuilder";
import { supabase } from "../services/supabaseClient";
import { DiscordReconnectRequired, reconnectDiscordAppearance, syncDiscordAppearance } from "../services/discordAppearanceService";
import { getPublishedDeckOptions } from "../services/publicDeckService";
import { getAllCards } from "../services/cardDataService";
import type { Card } from "../types/Card";
import PlayerProfileCard from "../components/PlayerProfileCard";
import { FeaturedDeckLabel, OwnFeaturedDeck } from "../components/PlayerProfileHighlights";
import ArchiveIcon from "../components/ArchiveIcon";
import styles from "./ProfilePage.module.scss";

type ProfileDraft = { bio: string; favoriteChronicle: string; website: string; appearance: ProfileAppearance };
type ProfileEditorState = { draft?: ProfileDraft; syncDiscord?: boolean };

function ProfileEditor({ user, routeState }: { user: User; routeState: ProfileEditorState | null }) {
  const profile = getPlayerProfile(user);
  const [bio, setBio] = useState(routeState?.draft?.bio ?? profile.bio);
  const [favoriteChronicle, setFavoriteChronicle] = useState(() => {
    const favorite = routeState?.draft?.favoriteChronicle ?? profile.favoriteChronicle;
    return FACTIONS.some(faction => faction === favorite) ? favorite : "";
  });
  const [website, setWebsite] = useState(routeState?.draft?.website ?? profile.website);
  const [appearance, setAppearance] = useState(() => routeState?.draft ? readProfileAppearance(routeState.draft.appearance) : profile.appearance);
  const [discord, setDiscord] = useState(profile.discord);
  const [busy, setBusy] = useState<"save" | "sync" | "reconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getPublishedDeckOptions>> | null>(null);
  const [optionsError, setOptionsError] = useState({ cards: false, decks: false });
  const [cardSearch, setCardSearch] = useState("");
  const navigate = useNavigate();
  const active = useRef(true);
  const pending = useRef(false);
  const resumed = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void getAllCards().then(result => {
      if (current) setCards(result.sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => { if (current) setOptionsError(value => ({ ...value, cards: true })); });
    void getPublishedDeckOptions(user.id).then(result => { if (current) setDecks(result); })
      .catch(() => { if (current) setOptionsError(value => ({ ...value, decks: true })); });
    return () => { current = false; };
  }, [user.id]);

  const sync = useCallback(async (draft?: ProfileDraft) => {
    if (pending.current) return;
    pending.current = true;
    setBusy("sync");
    setSyncError("");
    setSyncMessage("");
    try {
      const result = await syncDiscordAppearance(user.id);
      if (active.current) {
        setDiscord(result);
        if (!discord.id) {
          setAppearance(current => current.cover === "chronicle" && !current.showAvatarDecoration && !current.showNameplate && !current.showGuildTag
            ? applyDiscordCosmetics(current, result) : current);
        }
        setSyncMessage("Discord profile synced.");
      }
    } catch (error) {
      if (!active.current) return;
      if (error instanceof DiscordReconnectRequired) {
        if (draft) {
          setBusy("reconnect");
          try {
            await reconnectDiscordAppearance(user.id, draft);
          } catch (error) {
            if (active.current) setSyncError(error instanceof Error ? error.message : "Could not reconnect to Discord.");
          }
        } else {
          setSyncError("Discord did not return an active authorization. Try Sync from Discord again to reconnect.");
        }
      } else {
        setSyncError(error instanceof Error ? error.message : "Could not sync your Discord profile.");
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(null);
    }
  }, [discord.id, user.id]);

  useEffect(() => {
    if (!routeState?.syncDiscord || resumed.current) return;
    resumed.current = true;
    void sync();
  }, [routeState?.syncDiscord, sync]);

  const draft = { bio, favoriteChronicle, website, appearance };
  const updateAppearance = <K extends keyof ProfileAppearance>(key: K, value: ProfileAppearance[K]) => {
    setAppearance(current => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || pending.current) return;
    pending.current = true;
    setBusy("save");
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: {
        player_profile: { ...draft, bio: bio.trim(), website: profileWebsite(website) },
      } });
      if (error) throw error;
      if (active.current) navigate("/profile", { replace: true, state: { profileSaved: true } });
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : "Could not save your profile. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setBusy(null);
    }
  };

  const search = cardSearch.trim().toLowerCase();
  const matchingCards = cards?.filter(card => !search || `${card.name} ${card.setId}`.toLowerCase().includes(search)).slice(0, 60) ?? [];
  const chosenCard = cards?.find(card => card.id === appearance.favoriteCardId);
  if (chosenCard && !matchingCards.some(card => card.id === chosenCard.id)) matchingCards.unshift(chosenCard);
  const available = availableDiscordCosmetics(discord);
  const cosmeticNames = [available.cover, available.avatarDecoration && "avatar decoration", available.nameplate && "nameplate", available.guildTag && "server tag"].filter(Boolean);
  const canApplyDiscord = (available.cover && appearance.cover !== "discord") || (available.avatarDecoration && !appearance.showAvatarDecoration)
    || (available.nameplate && !appearance.showNameplate) || (available.guildTag && !appearance.showGuildTag);

  return <><form className={styles.editor} onSubmit={event => void save(event)} aria-busy={Boolean(busy)}>
    <fieldset disabled={Boolean(busy)}>
      <legend>Player details</legend>
      <label htmlFor="profile-bio">Bio</label>
      <textarea id="profile-bio" rows={4} maxLength={300} value={bio} onChange={event => setBio(event.target.value)} placeholder="Tell other players about your play style and favorite strategies." aria-describedby="profile-bio-count" />
      <span id="profile-bio-count" className={styles.hint}>{bio.length}/300 characters</span>
      <label htmlFor="profile-chronicle">Favorite chronicle</label>
      <ChronicleSelect id="profile-chronicle" value={favoriteChronicle} emptyLabel="No preference" onChange={event => setFavoriteChronicle(event.target.value)} />
      <label htmlFor="profile-website">Website or social link</label>
      <input id="profile-website" type="url" maxLength={500} value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://" />
    </fieldset>
    <fieldset disabled={Boolean(busy)}>
      <legend>Appearance</legend>
      <label htmlFor="profile-cover">Profile cover</label>
      <select id="profile-cover" value={appearance.cover} onChange={event => updateAppearance("cover", event.target.value as ProfileAppearance["cover"])}>
        <option value="chronicle">Favorite chronicle</option>
        <option value="discord">Discord banner or accent color</option>
        <option value="solid">Solid color</option>
      </select>
      {appearance.cover === "solid" && <label className={styles.colorField}>Cover color<input type="color" value={appearance.coverColor} onChange={event => updateAppearance("coverColor", event.target.value)} /></label>}
      <label htmlFor="profile-effect">Profile effect</label>
      <select id="profile-effect" value={appearance.effect} onChange={event => updateAppearance("effect", event.target.value as ProfileAppearance["effect"])}>
        <option value="none">None</option>
        <option value="chronicle">Chronicle glow</option>
      </select>
      <div className={styles.discordControls}>
        <button type="button" className={styles.secondary} onClick={() => void sync(draft)}>
          {busy === "sync" ? "Syncing Discord..." : busy === "reconnect" ? "Connecting to Discord..." : "Sync from Discord"}
        </button>
        {syncMessage && <p className={styles.hint} role="status">{syncMessage}</p>}
        {syncError && <p className={styles.error} role="alert">{syncError}</p>}
        {discord.id && (cosmeticNames.length ? <p className={styles.hint}>
          Discord returned {cosmeticNames.join(", ")}. <a href="#profile-preview">View preview</a> and save to publish your choices.
        </p> : <p className={styles.hint}>Discord returned no supported cosmetics from your main profile.</p>)}
        {canApplyDiscord && <button type="button" className={styles.secondary} onClick={() => setAppearance(current => applyDiscordCosmetics(current, discord))}>
          Use Discord appearance
        </button>}
        <label className={styles.toggle}><input type="checkbox" checked={appearance.showAvatarDecoration} onChange={event => updateAppearance("showAvatarDecoration", event.target.checked)} /> Show Discord avatar decoration</label>
        <label className={styles.toggle}><input type="checkbox" checked={appearance.showNameplate} onChange={event => updateAppearance("showNameplate", event.target.checked)} /> Show Discord nameplate</label>
        <label className={styles.toggle}><input type="checkbox" checked={appearance.showGuildTag} onChange={event => updateAppearance("showGuildTag", event.target.checked)} /> Show primary Discord server tag</label>
      </div>
    </fieldset>
    <fieldset disabled={Boolean(busy)}>
      <legend>Highlights</legend>
      <label htmlFor="profile-featured-deck">Featured public deck</label>
      <select id="profile-featured-deck" value={appearance.featuredDeckId} disabled={!decks}
        onChange={event => updateAppearance("featuredDeckId", event.target.value)}>
        <option value="">{optionsError.decks ? "Could not load decks" : !decks ? "Loading decks..." : "None"}</option>
        {appearance.featuredDeckId && !decks?.some(deck => deck.id === appearance.featuredDeckId) && <option value={appearance.featuredDeckId}>Selected deck unavailable</option>}
        {decks?.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
      </select>
      <label htmlFor="profile-card-search">Find a favorite card</label>
      <input id="profile-card-search" type="search" placeholder="Card name or set code" value={cardSearch} onChange={event => setCardSearch(event.target.value)} disabled={!cards} />
      <select aria-label="Favorite card" value={appearance.favoriteCardId} disabled={!cards} onChange={event => updateAppearance("favoriteCardId", event.target.value)}>
        <option value="">{optionsError.cards ? "Could not load cards" : !cards ? "Loading cards..." : search && !matchingCards.length ? "No matching cards" : "None"}</option>
        {appearance.favoriteCardId && !chosenCard && <option value={appearance.favoriteCardId}>Selected card unavailable</option>}
        {matchingCards.map(card => <option key={card.id} value={card.id}>{card.name} · {card.setId}</option>)}
      </select>
    </fieldset>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={() => navigate("/profile")}>Cancel</button>
      <button type="submit" className={styles.primary} disabled={Boolean(busy)}>{busy === "save" ? "Saving..." : "Save profile"}</button>
    </div>
  </form>
    <div className={styles.editorPreview} id="profile-preview">
      <h2>Profile preview</h2>
      <PlayerProfileCard profile={{ ...profile, ...draft, website: safeProfileUrl(website), discord }} emptyBio="Your story starts here. Add a bio to introduce yourself.">
        <FeaturedDeckLabel name={decks?.find(deck => deck.id === appearance.featuredDeckId)?.name} />
      </PlayerProfileCard>
    </div>
  </>;
}

export default function ProfilePage({ editing = false }: { editing?: boolean }) {
  const { user, authReady } = useOutletContext<AuthSession>();
  const location = useLocation();
  if (!authReady) return <div className={styles.page}><p role="status">Loading profile...</p></div>;
  if (!user) return <div className={styles.page}><h1>Your player profile</h1><p className={styles.intro}>Sign in with Discord from the account section to view and edit your profile.</p><Link className={styles.secondary} to="/">Back to overview</Link></div>;

  const profile = getPlayerProfile(user);
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>YOUR PLAYER PROFILE</span><h1>{editing ? "Edit profile" : "My profile"}</h1><p className={styles.intro}>{editing ? "Tell your story in Astralia." : "Your identity in the Deck Archive."}</p></div>
      {!editing && <Link className={styles.primary} to="/profile/edit"><ArchiveIcon name="edit" size={16} /> Edit profile</Link>}
    </header>
    {editing ? <ProfileEditor key={user.id} user={user} routeState={location.state} /> : <>
      {location.state?.profileSaved && <p className={styles.success} role="status">Profile saved.</p>}
      <PlayerProfileCard profile={profile} emptyBio="Your story starts here. Add a bio to introduce yourself.">
        {profile.appearance.featuredDeckId && <OwnFeaturedDeck key={profile.appearance.featuredDeckId} id={profile.appearance.featuredDeckId} ownerId={user.id} />}
      </PlayerProfileCard>
      <p className={styles.hint}>When you publish a deck or comment on a public deck, other players can see this profile and your published decks. <Link to={`/players/${user.id}`}>View public profile →</Link></p>
    </>}
  </div>;
}
