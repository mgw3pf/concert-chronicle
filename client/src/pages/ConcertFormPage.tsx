import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Artist, Venue } from "../lib/api";
import { Combobox, Option } from "../components/Combobox";

export function ConcertFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [date, setDate] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [lineup, setLineup] = useState<Artist[]>([]);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // New-venue detail fields shown after creating a venue by name.
  const [newVenueId, setNewVenueId] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .getConcert(id)
      .then(({ concert }) => {
        setDate(concert.date);
        setVenue(concert.venue);
        setLineup(concert.artists.map(({ id, name }) => ({ id, name })));
        setNotes(concert.notes);
        setRating(concert.rating);
      })
      .catch(() => setError("Couldn't load that concert."));
  }, [id]);

  const searchArtists = useCallback(
    async (q: string): Promise<Option[]> =>
      (await api.searchArtists(q)).artists.map((a) => ({
        id: a.id,
        label: a.name,
        sublabel: a.showCount ? `${a.showCount} show${a.showCount === 1 ? "" : "s"}` : undefined,
      })),
    []
  );
  const createArtist = useCallback(async (name: string): Promise<Option> => {
    const { artist } = await api.createArtist(name);
    return { id: artist.id, label: artist.name };
  }, []);

  const searchVenues = useCallback(
    async (q: string): Promise<Option[]> =>
      (await api.searchVenues(q)).venues.map((v) => ({
        id: v.id,
        label: v.name,
        sublabel: [v.city, v.region].filter(Boolean).join(", ") || undefined,
      })),
    []
  );
  const createVenue = useCallback(async (name: string): Promise<Option> => {
    const { venue } = await api.createVenue({ name });
    setNewVenueId(venue.id);
    return { id: venue.id, label: venue.name };
  }, []);

  const addArtist = (o: Option) =>
    setLineup((l) => (l.some((a) => a.id === o.id) ? l : [...l, { id: o.id, name: o.label }]));
  const removeArtist = (artistId: number) => setLineup((l) => l.filter((a) => a.id !== artistId));
  const moveUp = (index: number) =>
    setLineup((l) => {
      if (index === 0) return l;
      const next = [...l];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });

  const submit = async () => {
    setError("");
    if (!date) return setError("Pick the show date.");
    if (!venue) return setError("Pick a venue.");
    if (lineup.length === 0) return setError("Add at least one artist.");

    setBusy(true);
    try {
      // If the venue was just created and the user filled in a location,
      // resubmit it — the API's create-or-get keeps this idempotent by name+city.
      if (newVenueId === venue.id && (city || region)) {
        await api.createVenue({ name: venue.name, city, region });
      }
      const payload = {
        date,
        venueId: venue.id,
        artistIds: lineup.map((a) => a.id),
        notes,
        rating,
      };
      const res = editing
        ? await api.updateConcert(Number(id), payload)
        : await api.createConcert(payload);
      navigate(`/concerts/${res.concert.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the concert.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page form-page">
      <h1 className="page-title">{editing ? "Edit show" : "Log a show"}</h1>

      <label htmlFor="show-date">
        Date
        <input
          id="show-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label htmlFor="venue-input">Venue</label>
      {venue ? (
        <div className="chip-row">
          <span className="chip venue-chip">
            {venue.name}
            <button
              type="button"
              className="chip-x"
              aria-label={`Remove ${venue.name}`}
              onClick={() => {
                setVenue(null);
                setNewVenueId(null);
              }}
            >
              ×
            </button>
          </span>
        </div>
      ) : (
        <Combobox
          inputId="venue-input"
          placeholder="Search venues, or type a new one"
          search={searchVenues}
          create={createVenue}
          onSelect={(o) =>
            setVenue({ id: o.id, name: o.label, city: "", region: "", country: "" })
          }
          clearOnSelect
        />
      )}
      {venue && newVenueId === venue.id && (
        <div className="venue-details">
          <label>
            City
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            State / region
            <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
          </label>
        </div>
      )}

      <label htmlFor="artist-input">Lineup</label>
      <p className="hint">First artist is the headliner. Use ↑ to reorder.</p>
      {lineup.length > 0 && (
        <ol className="lineup">
          {lineup.map((a, i) => (
            <li key={a.id} className="chip">
              <span className="lineup-slot">{i === 0 ? "Headliner" : `Opener ${i}`}</span>
              {a.name}
              {i > 0 && (
                <button
                  type="button"
                  className="chip-x"
                  aria-label={`Move ${a.name} up`}
                  onClick={() => moveUp(i)}
                >
                  ↑
                </button>
              )}
              <button
                type="button"
                className="chip-x"
                aria-label={`Remove ${a.name}`}
                onClick={() => removeArtist(a.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      <Combobox
        inputId="artist-input"
        placeholder="Search artists, or type a new one"
        search={searchArtists}
        create={createArtist}
        onSelect={addArtist}
        clearOnSelect
      />

      <label>
        Rating
        <div className="rating-row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              className={`star ${rating != null && n <= rating ? "filled" : ""}`}
              onClick={() => setRating(rating === n ? null : n)}
            >
              ★
            </button>
          ))}
          {rating != null && (
            <button type="button" className="link-button" onClick={() => setRating(null)}>
              clear
            </button>
          )}
        </div>
      </label>

      <label htmlFor="notes">
        Notes
        <textarea
          id="notes"
          rows={4}
          placeholder="Setlist highlights, who you went with, the encore…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save show"}
        </button>
        <button className="btn-quiet" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
