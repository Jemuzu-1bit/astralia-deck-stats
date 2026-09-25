import { Routes, Route } from "react-router-dom";
import App from "./App";
import MyDecksPage from "./pages/MyDecksPage.tsx";
import LobbyPage from "./pages/LobbyPage.tsx";
import OnlineGamePage from "./pages/OnlineGamePage.tsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/my-decks" element={<MyDecksPage />} />
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      <Route path="/game" element={<OnlineGamePage />} />
      <Route path="/game/:code" element={<OnlineGamePage />} />
    </Routes>
  );
}
