import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { oveRunTheme, cssResolver } from "./theme";
import App from "./App";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

import "@mantine/core/styles.css";
import "./styles/globals.css";
import "./styles/tour.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MantineProvider
        theme={oveRunTheme}
        forceColorScheme="dark"
        cssVariablesResolver={cssResolver}
      >
        <App />
      </MantineProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
