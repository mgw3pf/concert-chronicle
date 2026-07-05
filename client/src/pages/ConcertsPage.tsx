import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Concert } from "../lib/api";
import { TicketCard } from "../components/TicketCard";

export function ConcertsPage() {
  const [concerts, setConcerts] = useState<Concert[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listConcerts()
      .then((r) => setConcerts(r.concerts))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your shows."));
  }, []);

  /** Lifetime show numbers: the earliest show is Nº 001. The list arrives
   *  newest-first, so serials count down from the total. */
  const serials = useMemo(() => {
    if (!concerts) return new Map<number, number>();
    const map = new Map<number, number>();
    concerts.forEach((c, i) => map.set(c.id, concerts.length - i));
    return map;
  }, [concerts]);

  const stats = useMemo(() => {
    if (!concerts) return null;
    const artists = new Set<number>();
    const venues = new Set<number>();
    for (const c of concerts) {
      venues.add(c.venue.id);
      for (const a of c.artists) artists.add(a.id);
    }
    return { shows: concerts.length, artists: artists.size, venues: venues.size };
  }, [concerts]);

  if (error) return <p className="page-error">{error}</p>;
  if (!concerts) return <p className="page-loading">Pulling your stubs…</p>;

  return (
    <div className="page">
      {stats && concerts.length > 0 && (
        <div className="stats-strip">
          <Stat label="shows" value={stats.shows} />
          <Stat label="artists" value={stats.artists} />
          <Stat label="venues" value={stats.venues} />
        </div>
      )}

      {concerts.length === 0 ? (
        <div className="empty-state">
          <p className="empty-headline">No stubs yet</p>
          <p>Log the first show you can remember — the ticket rack fills up fast.</p>
          <Link className="btn-primary" to="/concerts/new">
            Log a show
          </Link>
        </div>
      ) : (
        <div className="ticket-list">
          {concerts.map((c) => (
            <TicketCard key={c.id} concert={c} serial={serials.get(c.id) ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
