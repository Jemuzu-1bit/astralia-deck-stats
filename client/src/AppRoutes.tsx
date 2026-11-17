import { Routes, Route } from "react-router-dom";
import App from "./App";
import MyDecksPage from "./pages/MyDecksPage.tsx";
import LobbyPage from "./pages/LobbyPage.tsx";
import OnlineGamePage from "./pages/OnlineGamePage.tsx";
import HelpPage from "./pages/HelpPage.tsx";
import ArchiveLayout from "./components/ArchiveLayout";
import CardLibraryPage from "./pages/CardLibraryPage";
import ProfilePage from "./pages/ProfilePage";
import PublicDecksPage from "./pages/PublicDecksPage";
import PublicProfilePage from "./pages/PublicProfilePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<ArchiveLayout />}>
        <Route path="/" element={<App />} />
        <Route path="/my-decks" element={<MyDecksPage />} />
        <Route path="/public-decks" element={<PublicDecksPage />} />
        <Route path="/players/:playerId" element={<PublicProfilePage />} />
        <Route path="/cards" element={<CardLibraryPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfilePage editing />} />
      </Route>
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/lobby/:code" element={<LobbyPage />} />
      <Route path="/game" element={<OnlineGamePage />} />
      <Route path="/game/:code" element={<OnlineGamePage />} />
    </Routes>
  );
}
