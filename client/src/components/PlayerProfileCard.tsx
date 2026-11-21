import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CHRONICLES } from "../data/chronicles";
import { discordAppearanceImages, type getPlayerProfile } from "../domain/playerProfile";
import { getCardFaces } from "../services/cardDataService";
import { getCardImagePath } from "../services/cardImageService";
import type { Card } from "../types/Card";
import CardDetailsModal from "./CardDetailsModal";
import PlayerAvatar from "./PlayerAvatar";
import styles from "../pages/ProfilePage.module.scss";

const NAMEPLATE_COLORS: Record<string, string> = {
  crimson: "#7b3346", berry: "#71335e", sky: "#2d5e7e", teal: "#256862", forest: "#345e3c",
  bubble_gum: "#804868", violet: "#5c447b", cobalt: "#354c8b", clover: "#466444", lemon: "#6a5d2e", white: "#585867",
};

export default function PlayerProfileCard({ profile, emptyBio, children }: {
  profile: ReturnType<typeof getPlayerProfile>;
  emptyBio: string;
  children?: ReactNode;
}) {
  const { name, avatar, bio, favoriteChronicle, website, appearance, discord } = profile;
  const chronicle = Object.hasOwn(CHRONICLES, favoriteChronicle) ? CHRONICLES[favoriteChronicle] : null;
  const images = discordAppearanceImages(discord);
  const still = discordAppearanceImages(discord, false);
  const [failedBanner, setFailedBanner] = useState("");
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const useDiscordBanner = appearance.cover === "discord" && images.banner && images.banner !== failedBanner;
  const coverColor = appearance.cover === "solid" ? appearance.coverColor : appearance.cover === "discord" ? discord.accent : "";
  const chronicleCover = !useDiscordBanner && !coverColor ? chronicle?.image : "";
  const nameplate = appearance.showNameplate && (images.nameplate || discord.nameplatePalette);
  const coverStyle = {
    ...(coverColor ? { background: coverColor } : {}),
    ...(chronicleCover ? { backgroundImage: `linear-gradient(0deg, #18191d, #18191d30), url(${chronicleCover})` } : {}),
    "--profile-effect-color": chronicle?.color ?? "#d8ba76",
  } as CSSProperties;

  return <section className={styles.card} aria-label="Player profile">
    <div className={styles.cover} style={coverStyle}>
      {useDiscordBanner && <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={still.banner} />
        <img className={styles.bannerImage} src={images.banner} alt="" onError={() => setFailedBanner(images.banner)} />
      </picture>}
      {appearance.effect === "chronicle" && <div className={styles.chronicleEffect} aria-hidden="true" />}
    </div>
    <div className={styles.cardBody}>
      <div className={styles.heroAvatarWrap}>
        <PlayerAvatar name={name} avatar={images.avatar || avatar} staticAvatar={still.avatar} className={styles.heroAvatar} />
        {appearance.showAvatarDecoration && images.decoration && <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet={still.decoration} />
          <img className={styles.avatarDecoration} src={images.decoration} alt="" onError={event => { event.currentTarget.hidden = true; }} key={images.decoration} />
        </picture>}
      </div>
      <div className={styles.profileName}>
        <h2 className={nameplate ? styles.nameplate : undefined} style={nameplate ? {
          backgroundColor: NAMEPLATE_COLORS[discord.nameplatePalette] ?? "#354c64",
          backgroundImage: still.nameplate ? `url(${still.nameplate})` : undefined,
        } : undefined}>
          {nameplate && images.nameplate && !reduceMotion && <video key={images.nameplate} className={styles.nameplateMotion}
            src={images.nameplate} autoPlay muted loop playsInline aria-hidden="true" onError={event => { event.currentTarget.hidden = true; }} />}
          <span>{name}</span>
        </h2>
        {appearance.showGuildTag && discord.guildTag && <span className={styles.guildTag} title="Primary Discord server">
          {images.guildBadge && <img key={images.guildBadge} src={images.guildBadge} alt="" onError={event => { event.currentTarget.hidden = true; }} />}{discord.guildTag}
        </span>}
      </div>
      <p className={styles.bio}>{bio || emptyBio}</p>
      <dl className={styles.facts}>
        <div><dt>Favorite chronicle</dt><dd style={{ color: chronicle?.color }}>{chronicle?.name || "No preference"}</dd></div>
        {website && <div><dt>Website / social</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{new URL(website).hostname}</a></dd></div>}
      </dl>
      {appearance.favoriteCardId && <FavoriteCard key={appearance.favoriteCardId} id={appearance.favoriteCardId} />}
      {children}
    </div>
  </section>;
}

function FavoriteCard({ id }: { id: string }) {
  const [card, setCard] = useState<Card>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void getCardFaces(id).then(({ front }) => { if (active) setCard(front); }).catch(() => { /* Hide unavailable cards. */ });
    return () => { active = false; };
  }, [id]);
  if (!card) return null;
  return <div className={styles.profileHighlight}>
    <button type="button" className={styles.favoriteCard} onClick={() => setOpen(true)}>
      <img src={getCardImagePath(card)} loading="lazy" alt="" />
      <span><small>Favorite card</small><strong>{card.name}</strong></span>
    </button>
    {open && <CardDetailsModal card={card} onClose={() => setOpen(false)} />}
  </div>;
}
