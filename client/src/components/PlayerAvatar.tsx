import { useState } from "react";

export default function PlayerAvatar({ name, avatar, staticAvatar, className }: { name: string; avatar: string; staticAvatar?: string; className: string }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  if (!avatar || avatar === failedAvatar) return <span className={className} aria-hidden="true">{Array.from(name)[0]?.toUpperCase() || "D"}</span>;
  const image = <img className={className} src={avatar} alt="" onError={() => setFailedAvatar(avatar)} />;
  return staticAvatar && staticAvatar !== avatar ? <picture>
    <source media="(prefers-reduced-motion: reduce)" srcSet={staticAvatar} />{image}
  </picture> : image;
}
