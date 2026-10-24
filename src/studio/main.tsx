import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "../ui/styles.css";
import "./studio.css";
import { Studio } from "./Studio";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);
