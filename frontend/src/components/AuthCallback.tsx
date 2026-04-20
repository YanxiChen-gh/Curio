import { useEffect, useState } from "react";
import { setToken } from "../lib/api";

interface Props {
  onAuth: (user: { id: string; email: string; name: string }) => void;
}

export default function AuthCallback({ onAuth }: Props) {
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setError("No authorization code received");
      return;
    }

    fetch("/api/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirect_uri: window.location.origin + "/auth/callback",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setToken(data.token);
        onAuth(data.user);
        window.history.replaceState({}, "", "/");
      })
      .catch((err) => setError(err.message));
  }, [onAuth]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <a href="/" className="text-[var(--curio-red)] text-sm underline">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-[var(--curio-muted)]">
      Signing in...
    </div>
  );
}
