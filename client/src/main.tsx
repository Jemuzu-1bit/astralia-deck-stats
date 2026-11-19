import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import CustomCursor from "./components/CustomCursor";
import UsageAnalytics from "./components/UsageAnalytics";
import "./index.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AppRoutes />
      <UsageAnalytics />
      <CustomCursor />
    </Router>
  </StrictMode>
);
