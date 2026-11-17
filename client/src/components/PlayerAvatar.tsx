import { useState } from "react";

export default function PlayerAvatar({ name, avatar, className }: { name: string; avatar: string; className: string }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  return avatar && avatar !== failedAvatar
    ? <img className={className} src={avatar} alt="" onError={() => setFailedAvatar(avatar)} />
    : <span className={className} aria-hidden="true">{Array.from(name)[0]?.toUpperCase() || "D"}</span>;
}
