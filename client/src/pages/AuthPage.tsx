import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, displayName);
      setUser(res.user);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">Box office</p>
        <h1 className="auth-title">Concert Chronicle</h1>
        <p className="auth-sub">Every show you've seen, kept like a stub in your pocket.</p>

        <div className="auth-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {mode === "register" && <span className="hint">At least 8 characters.</span>}
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );
}
