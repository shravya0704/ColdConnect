import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import './index.css';   // 👈 must be here so Tailwind loads

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
