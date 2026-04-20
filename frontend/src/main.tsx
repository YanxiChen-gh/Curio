import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App.tsx";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

if (!CLERK_KEY && !DEV_BYPASS) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {DEV_BYPASS ? (
      <App />
    ) : (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <App />
      </ClerkProvider>
    )}
  </StrictMode>,
);
