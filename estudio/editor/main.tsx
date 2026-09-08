import React from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";
import "./estilos.css";

createRoot(document.getElementById("raiz")!).render(
  <React.StrictMode>
    <Editor />
  </React.StrictMode>,
);
