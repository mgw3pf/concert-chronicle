import { Link } from "react-router-dom";
import { Concert } from "../lib/api";

/**
 * The signature element of the app: each show renders as a ticket stub.
 * `serial` is the lifetime show number (first show ever attended = 001),
 * printed on the perforated stub the way a serial runs along a real ticket.
 */
export function TicketCard({ concert, serial }: { concert: Concert; serial: number }) {
  const headliner = concert.artists.find((a) => a.slot === 0) ?? concert.artists[0];
  const openers = concert.artists.filter((a) => a !== headliner);
  const place = [concert.venue.city, concert.venue.region].filter(Boolean).join(", ");

  return (
    <Link to={`/concerts/${concert.id}`} className="ticket">
      <div className="ticket-stub-edge" aria-hidden="true">
        <span className="ticket-serial">Nº {String(serial).padStart(3, "0")}</span>
      </div>
      <div className="ticket-body">
        <div className="ticket-top">
          <time className="ticket-date" dateTime={concert.date}>
            {formatDate(concert.date)}
          </time>
          {concert.rating != null && (
            <span className="ticket-rating" aria-label={`Rated ${concert.rating} of 5`}>
              {"★".repeat(concert.rating)}
              <span className="rating-empty">{"★".repeat(5 - concert.rating)}</span>
            </span>
          )}
        </div>
        <h3 className="ticket-headliner">{headliner?.name}</h3>
        {openers.length > 0 && (
          <p className="ticket-openers">with {openers.map((a) => a.name).join(" · ")}</p>
        )}
        <p className="ticket-venue">
          {concert.venue.name}
          {place && <span className="ticket-city"> — {place}</span>}
        </p>
        {concert.photos.length > 0 && (
          <span className="ticket-photos">
            {concert.photos.length} photo{concert.photos.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </Link>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
