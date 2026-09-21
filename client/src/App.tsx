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
        <button
          onClick={() =>
            window.open("https://www.astraliachronicles.com/cards", "_blank")
          }
        >
          cards
        </button>
        <button
          onClick={() =>
            window.open(
              "https://drive.google.com/file/d/1m4AbGJR_e4ywfj-e-fKoaJ01asj_D9Cp/view",
              "_blank"
            )
          }
        >
          rules
        </button>
      </div>
    </div>
  );
}

export default App;
