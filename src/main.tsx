import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { agenticTheme, cssResolver } from "./theme";
import App from "./App";

import "@mantine/core/styles.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider
      theme={agenticTheme}
      forceColorScheme="dark"
      cssVariablesResolver={cssResolver}
    >
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
