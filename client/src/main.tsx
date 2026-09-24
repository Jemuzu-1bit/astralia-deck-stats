import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import CustomCursor from "./components/CustomCursor";
import "./index.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AppRoutes />
      <CustomCursor />
    </Router>
  </StrictMode>
);
