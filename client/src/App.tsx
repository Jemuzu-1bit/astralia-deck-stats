import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./App.module.scss";
import { gameConnection } from "./services/gameConnection";
import { features } from "./config/features";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const onlineControlsVisible =
    features.onlineMenu || new URLSearchParams(location.search).get("online") === "1";
  const [name, setName] = useState(() => localStorage.getItem("astralia.playerName") || "");
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => gameConnection.onError(setError), []);
  const connectAnd = (action: () => void) => {
    gameConnection.connect();
    gameConnection.runWhenConnected(action);
    localStorage.setItem("astralia.playerName", name.trim());
    navigate("/lobby");
  };

  return (
    <div className={styles.pageRoot}>
      <div className={styles.menuLayout}>
        {onlineControlsVisible && <>
          <input className={styles.nameInput} placeholder="your name" value={name} onChange={(event) => setName(event.target.value)} />
          <button className={styles.playButton} onClick={() => connectAnd(() => gameConnection.host(name || "Host"))}>
            host game
          </button>
          <button className={styles.playButton} onClick={() => { setError(null); setShowJoin(true); }}>
            join game
          </button>
        </>}
        <button
          className={styles.decksButton}
          onClick={() => navigate("/my-decks")}
        >
          my decks
        </button>
      </div>
      {onlineControlsVisible && showJoin && (
        <div className={styles.modalOverlay} onClick={() => setShowJoin(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2>Join game</h2>
            {error && <p className={styles.error}>{error}</p>}
            <input className={styles.codeInput} placeholder="AB12CD" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} autoFocus />
            <button className={styles.playButton} disabled={!joinCode.trim()} onClick={() => connectAnd(() => gameConnection.join(name || "Guest", joinCode))}>join</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
