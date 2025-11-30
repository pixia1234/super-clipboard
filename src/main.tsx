import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import "./main.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root 未找到，无法挂载应用。");
}

ReactDOM.createRoot(rootElement).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
