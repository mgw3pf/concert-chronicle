import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Concert } from "../lib/api";
import { formatDate } from "../components/TicketCard";

export function ConcertDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!id) return;
    api
      .getConcert(id)
      .then((r) => setConcert(r.concert))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load that concert."));
  };
  useEffect(load, [id]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !concert) return;
    setUploading(true);
    setError("");
    try {
      await api.uploadPhotos(concert.id, Array.from(files));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = async (photoId: number) => {
    if (!window.confirm("Delete this photo?")) return;
    await api.deletePhoto(photoId).catch(() => setError("Couldn't delete that photo."));
    load();
  };

  const removeConcert = async () => {
    if (!concert) return;
    if (!window.confirm("Delete this show and all of its photos?")) return;
    try {
      await api.deleteConcert(concert.id);
      navigate("/");
    } catch {
      setError("Couldn't delete the show.");
    }
  };

  if (error && !concert) return <p className="page-error">{error}</p>;
  if (!concert) return <p className="page-loading">Finding that stub…</p>;

  const headliner = concert.artists.find((a) => a.slot === 0) ?? concert.artists[0];
  const openers = concert.artists.filter((a) => a !== headliner);
  const place = [concert.venue.city, concert.venue.region, concert.venue.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="page detail-page">
      <Link to="/" className="back-link">← All shows</Link>

      <div className="detail-header">
        <time className="detail-date" dateTime={concert.date}>{formatDate(concert.date)}</time>
        <h1 className="detail-headliner">{headliner?.name}</h1>
        {openers.length > 0 && (
          <p className="detail-openers">with {openers.map((a) => a.name).join(" · ")}</p>
        )}
        <p className="detail-venue">
          {concert.venue.name}
          {place && ` — ${place}`}
        </p>
        {concert.rating != null && (
          <p className="detail-rating" aria-label={`Rated ${concert.rating} of 5`}>
            {"★".repeat(concert.rating)}
            <span className="rating-empty">{"★".repeat(5 - concert.rating)}</span>
          </p>
        )}
      </div>

      {concert.notes && <p className="detail-notes">{concert.notes}</p>}

      <div className="detail-photos">
        <div className="photos-header">
          <h2>Photos</h2>
          <button
            className="btn-quiet"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Add photos"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {concert.photos.length === 0 ? (
          <p className="hint">No photos yet. Add the blurry encore shot — it counts.</p>
        ) : (
          <div className="photo-grid">
            {concert.photos.map((p) => (
              <figure key={p.id} className="photo-cell">
                <button className="photo-open" onClick={() => setLightbox(p.url)}>
                  <img src={p.thumbUrl} alt={p.originalName || "Concert photo"} loading="lazy" />
                </button>
                <button
                  className="photo-delete"
                  aria-label="Delete photo"
                  onClick={() => removePhoto(p.id)}
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      <div className="detail-actions">
        <Link className="btn-quiet" to={`/concerts/${concert.id}/edit`}>Edit show</Link>
        <button className="btn-danger" onClick={removeConcert}>Delete show</button>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <img src={lightbox} alt="Concert photo, full size" />
        </div>
      )}
    </div>
  );
}
