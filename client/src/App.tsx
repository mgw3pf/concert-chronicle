import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AuthPage } from "./pages/AuthPage";
import { ConcertsPage } from "./pages/ConcertsPage";
import { ConcertFormPage } from "./pages/ConcertFormPage";
import { ConcertDetailPage } from "./pages/ConcertDetailPage";

function Shell() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <p className="page-loading">House lights…</p>;
  if (!user) return <AuthPage />;

  return (
    <>
      <header className="marquee">
        <Link to="/" className="wordmark">
          Concert Chronicle
        </Link>
        <nav className="marquee-nav">
          <Link to="/concerts/new" className="btn-primary btn-small">
            Log a show
          </Link>
          <span className="whoami">{user.displayName}</span>
          <button className="link-button" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ConcertsPage />} />
          <Route path="/concerts/new" element={<ConcertFormPage />} />
          <Route path="/concerts/:id" element={<ConcertDetailPage />} />
          <Route path="/concerts/:id/edit" element={<ConcertFormPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
