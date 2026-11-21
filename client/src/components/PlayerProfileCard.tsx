import type { ReactNode } from "react";
import { CHRONICLES } from "../data/chronicles";
import type { getPlayerProfile } from "../domain/playerProfile";
import PlayerProfileIdentity from "./PlayerProfileIdentity";
import { FavoriteCard } from "./PlayerProfileHighlights";
import styles from "../pages/ProfilePage.module.scss";

type Profile = ReturnType<typeof getPlayerProfile>;

export function PlayerProfileDetails({ profile, emptyBio, compact = false }: {
  profile: Pick<Profile, "bio" | "favoriteChronicle" | "website">;
  emptyBio?: string;
  compact?: boolean;
}) {
  const { bio, favoriteChronicle, website } = profile;
  const chronicle = Object.hasOwn(CHRONICLES, favoriteChronicle) ? CHRONICLES[favoriteChronicle] : null;
  if (compact && !bio && !chronicle && !website) return null;
  return <div className={compact ? styles.compactDetails : undefined}>
    {(bio || emptyBio) && <p className={styles.bio}>{bio || emptyBio}</p>}
    {(!compact || chronicle || website) && <dl className={styles.facts}>
      {(!compact || chronicle) && <div><dt>Favorite chronicle</dt><dd style={{ color: chronicle?.color }}>{chronicle?.name || "No preference"}</dd></div>}
      {website && <div><dt>Website / social</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{new URL(website).hostname}</a></dd></div>}
    </dl>}
  </div>;
}

export default function PlayerProfileCard({ profile, emptyBio, children }: {
  profile: Profile;
  emptyBio: string;
  children?: ReactNode;
}) {
  const { favoriteCardId } = profile.appearance;
  return <section className={styles.card} aria-label="Player profile">
    <PlayerProfileIdentity profile={profile} />
    <div className={styles.cardBody}>
      <PlayerProfileDetails profile={profile} emptyBio={emptyBio} />
      {favoriteCardId && <FavoriteCard key={favoriteCardId} id={favoriteCardId} />}
      {children}
    </div>
  </section>;
}
