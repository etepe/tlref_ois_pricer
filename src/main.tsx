import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";

function App(): JSX.Element {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl text-accent-amber">TLREF OIS Pricer</h1>
      <p className="text-fg-muted mt-2">Scaffold ready. Core modules incoming.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
