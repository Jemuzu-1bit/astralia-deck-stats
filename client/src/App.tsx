import { useNavigate } from "react-router-dom";
import styles from "./App.module.scss";

function App() {
  const navigate = useNavigate();

  return (
    <div className={styles.pageRoot}>
      <div className={styles.menuLayout}>
        <button
          className={styles.decksButton}
          onClick={() => navigate("/my-decks")}
        >
          my decks
        </button>
      </div>
    </div>
  );
}

export default App;
