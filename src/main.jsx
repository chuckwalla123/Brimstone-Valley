import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AnimationLayer from './animations/AnimationLayer';
import "./style.css";

const container = document.getElementById("root");

  if (!container) {
  // If #root is missing for any reason, create a fallback so the app can still mount.
  const fallback = document.createElement("div");
  fallback.id = "root";
  document.body.appendChild(fallback);
  console.warn('No element with id "root" found — created fallback #root.');
  const root = createRoot(fallback);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  } else {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AnimationLayer>
        <App />
      </AnimationLayer>
    </React.StrictMode>
  );
}