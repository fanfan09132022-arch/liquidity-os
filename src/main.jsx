import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppStateProvider } from "./context/AppStateProvider";
import Dashboard from "./pages/Dashboard";
import L0MacroPage from "./pages/L0MacroPage";
import L1LiquidityPage from "./pages/L1LiquidityPage";
import L2StablecoinsPage from "./pages/L2StablecoinsPage";
import L3MemeSectorPage from "./pages/L3MemeSectorPage";
import L4WorkbenchPage from "./pages/L4WorkbenchPage";
import { storage } from "./lib/storage";
import "./styles.css";

window.storage = storage;

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppStateProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/macro" element={<L0MacroPage />} />
        <Route path="/liquidity" element={<L1LiquidityPage />} />
        <Route path="/stablecoins" element={<L2StablecoinsPage />} />
        <Route path="/meme" element={<L3MemeSectorPage />} />
        <Route path="/workbench" element={<L4WorkbenchPage />} />
      </Routes>
    </AppStateProvider>
  </BrowserRouter>
);
