import { useEffect, useState, type CSSProperties } from "react";
import { CHRONICLES } from "../data/chronicles";
import { discordAppearanceImages, type getPlayerProfile } from "../domain/playerProfile";
import PlayerAvatar from "./PlayerAvatar";
import styles from "./PlayerProfileIdentity.module.scss";

const NAMEPLATE_COLORS: Record<string, string> = {
  crimson: "#7b3346", berry: "#71335e", sky: "#2d5e7e", teal: "#256862", forest: "#345e3c",
  bubble_gum: "#804868", violet: "#5c447b", cobalt: "#354c8b", clover: "#466444", lemon: "#6a5d2e", white: "#585867",
};

type ProfileIdentity = Pick<ReturnType<typeof getPlayerProfile>, "name" | "avatar" | "favoriteChronicle" | "appearance" | "discord">;

export default function PlayerProfileIdentity({ profile, compact = false }: { profile: ProfileIdentity; compact?: boolean }) {
  const { name, avatar, favoriteChronicle, appearance, discord } = profile;
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

  const banner = appearance.cover === "discord" && images.banner !== failedBanner ? images.banner : "";
  const coverColor = appearance.cover === "solid" ? appearance.coverColor : appearance.cover === "discord" ? discord.accent : "";
  const chronicleCover = !banner && !coverColor ? chronicle?.image : "";
  const nameplate = appearance.showNameplate && Boolean(images.nameplate || discord.nameplatePalette);
  const coverStyle = {
    ...(coverColor ? { background: coverColor } : {}),
    ...(chronicleCover ? { backgroundImage: `linear-gradient(0deg, #18191d, #18191d30), url(${chronicleCover})` } : {}),
    "--profile-effect-color": chronicle?.color ?? "#d8ba76",
  } as CSSProperties;
  const Container = compact ? "span" : "div";
  const Name = compact ? "strong" : "h2";

  return <Container className={`${styles.identity} ${compact ? styles.compact : ""}`}>
    <span className={styles.cover} style={coverStyle}>
      {banner && <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={still.banner} />
        <img className={styles.bannerImage} src={banner} alt="" onError={() => setFailedBanner(banner)} />
      </picture>}
      {appearance.effect === "chronicle" && <span className={styles.chronicleEffect} aria-hidden="true" />}
    </span>
    <Container className={styles.identityBody}>
      <span className={styles.avatarWrap}>
        <PlayerAvatar name={name} avatar={images.avatar || avatar} staticAvatar={still.avatar} className={styles.avatar} />
        {appearance.showAvatarDecoration && images.decoration && <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet={still.decoration} />
          <img className={styles.avatarDecoration} src={images.decoration} alt="" onError={event => { event.currentTarget.hidden = true; }} key={images.decoration} />
        </picture>}
      </span>
      <Container className={styles.profileName}>
        <Name className={`${styles.name} ${nameplate ? styles.nameplate : ""}`} style={nameplate ? {
          backgroundColor: NAMEPLATE_COLORS[discord.nameplatePalette] ?? "#354c64",
          backgroundImage: still.nameplate ? `url(${still.nameplate})` : undefined,
        } : undefined}>
          {nameplate && images.nameplate && !reduceMotion && <video key={images.nameplate} className={styles.nameplateMotion}
            src={images.nameplate} autoPlay muted loop playsInline aria-hidden="true" onError={event => { event.currentTarget.hidden = true; }} />}
          <span className={styles.nameText} title={compact ? name : undefined}>{name}</span>
        </Name>
        {appearance.showGuildTag && discord.guildTag && <span className={styles.guildTag} title="Primary Discord server">
          {images.guildBadge && <img key={images.guildBadge} src={images.guildBadge} alt="" onError={event => { event.currentTarget.hidden = true; }} />}{discord.guildTag}
        </span>}
      </Container>
    </Container>
  </Container>;
}
