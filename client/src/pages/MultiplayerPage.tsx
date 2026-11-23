import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import ArchiveIcon from "../components/ArchiveIcon";
import type { AuthSession } from "../hooks/useAuthSession";
import { getPlayerProfile } from "../domain/playerProfile";
import { gameConnection, type PublicRoom } from "../services/gameConnection";
import { supabase } from "../services/supabaseClient";
import styles from "./MultiplayerPage.module.scss";

export default function MultiplayerPage() {
  const navigate = useNavigate();
  const { user, authReady } = useOutletContext<AuthSession>();
  const [params] = useSearchParams();
  const [name, setName] = useState(() => localStorage.getItem("astralia.playerName") || "");
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<"create" | "join" | null>(params.get("create") === "1" ? "create" : params.get("join") === "1" ? "join" : null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeRoom, setActiveRoom] = useState(gameConnection.getCurrentState());
  const mounted = useRef(false);
  const fetching = useRef(false);
  const pending = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultName = user ? getPlayerProfile(user).name : "";
  const effectiveName = name.trim() || defaultName;

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const result = await gameConnection.listPublicRooms();
      if (mounted.current) { setRooms(result); setListError(null); }
    } catch (caught) {
      if (mounted.current) setListError(caught instanceof Error ? caught.message : "Could not load rooms.");
    } finally {
      fetching.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const offConnect = gameConnection.onConnect(() => { void refresh(); });
    const offState = gameConnection.onState((state) => {
      setActiveRoom(state);
      if (pending.current && state.code && state.viewerRole) {
        pending.current = false;
        navigate(`/${state.started ? "game" : "lobby"}/${state.code}${state.viewerRole === "spectator" ? "?watch=1" : ""}`);
      }
    });
    const offError = gameConnection.onError((message) => { setError(message); setBusy(false); pending.current = false; });
    gameConnection.connect();
    if (gameConnection.isConnected()) void refresh();
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => {
      mounted.current = false;
      offConnect(); offState(); offError(); clearInterval(interval);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [navigate, refresh]);

  useEffect(() => {
    if (!dialog) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending.current) setDialog(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [dialog]);

  async function enter(action: (accessToken?: string) => void, asPlayer = true) {
    if (pending.current) return;
    setError(null);
    if (asPlayer && !authReady) return;
    if (asPlayer && !effectiveName) { setError("Enter your player name first."); return; }
    if (!gameConnection.isConnected()) { gameConnection.connect(); setError("Connecting to the game server. Please try again."); return; }
    if (activeRoom.code) { setError("Return to your current room and leave it before joining another."); return; }
    if (asPlayer) localStorage.setItem("astralia.playerName", effectiveName.slice(0, 24));
    pending.current = true;
    setBusy(true);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    let accessToken: string | undefined;
    if (asPlayer && user && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user.id === user.id) accessToken = session.access_token;
      } catch { /* The account name is still available to enter the room. */ }
      if (!mounted.current || !pending.current) return;
      if (!gameConnection.isConnected()) {
        pending.current = false;
        setBusy(false);
        setError("Connecting to the game server. Please try again.");
        return;
      }
    }
    pendingTimer.current = setTimeout(() => {
      if (mounted.current && pending.current) {
        setError("The server is taking longer than expected. Waiting for confirmation…");
      }
    }, 10000);
    action(accessToken);
  }
  function open(next: "create" | "join") { setError(null); setDialog(next); }
  const activeRoomPath = activeRoom.code
    ? `/${activeRoom.started ? "game" : "lobby"}/${activeRoom.code}${activeRoom.viewerRole === "spectator" ? "?watch=1" : ""}`
    : null;
  const returnLabel = activeRoom.started ? "Return to match" : "Return to lobby";
  const visible = rooms.filter(room => `${room.roomName} ${room.hostName}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "open" ? !room.started && room.playerCount < 2 : room.started)));

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>TAKE IT TO THE TABLE</span><h1>Multiplayer</h1><p>Find an opponent. Bring your deck. Write your next chapter.</p></div>
      <div className={styles.actions}>
        {activeRoomPath ? (
          <Link className={styles.primary} to={activeRoomPath}>{returnLabel} <ArchiveIcon name="arrow" size={17} /></Link>
        ) : (
          <>
            <button className={styles.secondary} onClick={() => open("join")}><ArchiveIcon name="lock" size={17} /> Join with code</button>
            <button className={styles.primary} onClick={() => open("create")}><ArchiveIcon name="plus" size={18} /> Create room</button>
          </>
        )}
      </div>
    </header>
    <section className={styles.identity} aria-label="Player identity">
      <span className={styles.identityIcon}><ArchiveIcon name="user" /></span>
      <label htmlFor="multiplayer-name">Your player name<span>Used in the room list and during the match.</span></label>
      <input id="multiplayer-name" maxLength={24} placeholder={defaultName || "Enter your name"} value={name} onChange={event => setName(event.target.value)} />
    </section>
    {error && (!dialog || activeRoomPath) && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.columns}>
      <section className={styles.rooms} aria-labelledby="public-rooms-heading">
        <div className={styles.sectionHeading}><div><h2 id="public-rooms-heading">Public rooms <span className={styles.count}>{rooms.length}</span></h2><p>Take a seat or watch a match unfold.</p></div><button className={styles.iconButton} aria-label="Refresh public rooms" onClick={() => void refresh()}><ArchiveIcon name="refresh" size={18} /></button></div>
        <div className={styles.toolbar}><div className={styles.tabs} aria-label="Filter rooms">{[["all", "All rooms"], ["open", "Open seats"], ["live", "In progress"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? styles.selectedTab : undefined} onClick={() => setFilter(value)}>{label}</button>)}</div><label className={styles.search}><ArchiveIcon name="search" size={17} /><input aria-label="Search rooms or hosts" placeholder="Search rooms or hosts…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        {listError ? <div className={styles.empty} role="alert"><ArchiveIcon name="refresh" size={30} /><h3>Rooms are unavailable</h3><p>{listError}</p><button className={styles.secondary} onClick={() => void refresh()}>Try again</button></div> : loading ? <div className={styles.empty} role="status"><p>Connecting to the lobby…</p></div> : visible.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><ArchiveIcon name="multiplayer" size={34} /></span>
            {rooms.length ? (
              <><h3>No matching rooms</h3><p>Try another search or room filter.</p></>
            ) : activeRoomPath ? (
              <h3>No public rooms yet.</h3>
            ) : (
              <>
                <h3>The next match starts with you.</h3>
                <p>Create a public room and let your next opponent find you.</p>
                <button className={styles.primary} onClick={() => open("create")}><ArchiveIcon name="plus" size={17} /> Create a room</button>
              </>
            )}
          </div>
        ) : <div className={styles.roomList}>{visible.map(room => <article key={room.code} className={styles.room}>
          <span className={styles.roomIcon}><ArchiveIcon name={room.started ? "play" : "multiplayer"} size={23} /></span>
          <div className={styles.roomInfo}>
            <div className={styles.roomTitle}><h3>{room.roomName}</h3><span className={room.started ? styles.live : styles.status}>{room.started ? "In progress" : room.playerCount === 2 ? "Full" : "Open seat"}</span></div>
            <p>Hosted by <strong>{room.hostName}</strong><span>·</span>{room.playerCount}/2 players<span>·</span>{room.spectatorCount} watching</p>
          </div>
          {activeRoomPath ? (
            room.code === activeRoom.code && (
              <div className={styles.roomActions}>
                <Link className={styles.primary} to={activeRoomPath}>{returnLabel} <ArchiveIcon name="arrow" size={17} /></Link>
              </div>
            )
          ) : (
            <div className={styles.roomActions}>
              <button className={styles.primary} disabled={busy || !authReady || room.started || room.playerCount >= 2} onClick={() => void enter(token => gameConnection.join(effectiveName, room.code, token))}><ArchiveIcon name="play" size={15} /> Join as player</button>
              <button className={styles.secondary} disabled={busy || room.spectatorCount >= 20} onClick={() => enter(() => gameConnection.watch(room.code), false)}><ArchiveIcon name="eye" size={17} /> Spectate</button>
            </div>
          )}
        </article>)}</div>}
        <div className={styles.listFooter}><span>Public rooms refresh every 5 seconds.</span><span>2 players per match</span></div>
      </section>
      <aside className={styles.aside}>
        <section className={styles.privatePanel}>
          <span className={styles.panelIcon}><ArchiveIcon name="lock" size={24} /></span>
          <span className={styles.eyebrow}>JUST YOU AND YOUR INVITE</span>
          <h2>A table for friends.</h2>
          <p>Private rooms stay off the public list. Share the six-character code with players and spectators.</p>
          {!activeRoomPath && <>
            <button className={styles.secondary} onClick={() => open("join")}>Join with code</button>
            <button className={styles.textButton} onClick={() => { setVisibility("private"); open("create"); }}>Create a private room</button>
          </>}
        </section>
        <section className={styles.how}><h3>From deck to duel</h3><p><ArchiveIcon name="decks" size={18} /><span>Choose a saved deck in the room.</span></p><p><ArchiveIcon name="multiplayer" size={18} /><span>Wait for both players to be ready.</span></p><p><ArchiveIcon name="play" size={18} /><span>The host starts the match.</span></p><Link to="/help">Getting started</Link></section>
      </aside>
    </div>
    {dialog && !activeRoomPath && <div className={styles.overlay} onClick={() => { if (!busy) setDialog(null); }}><form className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="room-dialog-title" onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onSubmit={event => {
      event.preventDefault();
      if (dialog === "create") void enter(token => gameConnection.host(effectiveName, { visibility, roomName: roomName.trim(), accessToken: token }));
      else if (/^[A-F0-9]{6}$/.test(code)) void enter(token => gameConnection.join(effectiveName, code, token));
    }}>
      <button type="button" className={styles.close} aria-label="Close dialog" disabled={busy} onClick={() => setDialog(null)}><ArchiveIcon name="close" /></button><span className={styles.eyebrow}>{dialog === "create" ? "YOUR NEXT MATCH" : "INVITE ONLY"}</span><h2 id="room-dialog-title">{dialog === "create" ? "Create a room" : "Join a private room"}</h2>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <label htmlFor="dialog-name">Player name</label><input id="dialog-name" maxLength={24} value={name} placeholder={defaultName || "Enter your name"} onChange={event => setName(event.target.value)} autoFocus />
      {dialog === "create" ? <><label htmlFor="room-name">Room name</label><input id="room-name" maxLength={60} placeholder="Give your table a name" value={roomName} onChange={event => setRoomName(event.target.value)} required /><fieldset className={styles.visibility}><legend>Visibility</legend>{(["public", "private"] as const).map(value => <label key={value}><input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => setVisibility(value)} /><strong>{value === "public" ? "Public" : "Private"}</strong><span>{value === "public" ? "Listed for everyone to join or watch." : "Only accessible with your room code."}</span></label>)}</fieldset><button className={styles.primary} disabled={busy || !authReady || !effectiveName || !roomName.trim()}>{busy ? "Creating room…" : "Create room"}</button></> : <><p>Use a code to take the second seat or watch the match.</p><label htmlFor="private-code">Room code</label><input id="private-code" className={styles.codeInput} placeholder="AB12CD" maxLength={6} pattern="[A-Fa-f0-9]{6}" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} /><div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy || !authReady || !effectiveName || !/^[A-F0-9]{6}$/.test(code)}>Join as player</button><button type="button" className={styles.secondary} disabled={busy || !/^[A-F0-9]{6}$/.test(code)} onClick={() => enter(() => gameConnection.watch(code), false)}><ArchiveIcon name="eye" size={17} /> Join as spectator</button></div></>}
      {busy && <p role="status">Waiting for the server…</p>}
    </form></div>}
  </div>;
}
