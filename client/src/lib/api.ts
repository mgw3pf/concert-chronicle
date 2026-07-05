export type User = { id: number; email: string; displayName: string };
export type Artist = { id: number; name: string; showCount?: number };
export type Venue = {
  id: number;
  name: string;
  city: string;
  region: string;
  country: string;
  showCount?: number;
};
export type Photo = { id: number; originalName: string; url: string; thumbUrl: string };
export type Concert = {
  id: number;
  date: string;
  notes: string;
  rating: number | null;
  venue: Venue;
  artists: (Artist & { slot: number })[];
  photos: Photo[];
};

export type ConcertPayload = {
  date: string;
  venueId: number;
  artistIds: number[];
  notes?: string;
  rating?: number | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || "Request failed.");
  return body as T;
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),

  searchArtists: (q: string) =>
    request<{ artists: Artist[] }>(`/api/artists?q=${encodeURIComponent(q)}`),
  createArtist: (name: string) =>
    request<{ artist: Artist }>("/api/artists", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  searchVenues: (q: string) =>
    request<{ venues: Venue[] }>(`/api/venues?q=${encodeURIComponent(q)}`),
  createVenue: (venue: { name: string; city?: string; region?: string; country?: string }) =>
    request<{ venue: Venue }>("/api/venues", {
      method: "POST",
      body: JSON.stringify(venue),
    }),

  listConcerts: () => request<{ concerts: Concert[] }>("/api/concerts"),
  getConcert: (id: number | string) => request<{ concert: Concert }>(`/api/concerts/${id}`),
  createConcert: (data: ConcertPayload) =>
    request<{ concert: Concert }>("/api/concerts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConcert: (id: number, data: ConcertPayload) =>
    request<{ concert: Concert }>(`/api/concerts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteConcert: (id: number) =>
    request<{ ok: true }>(`/api/concerts/${id}`, { method: "DELETE" }),

  uploadPhotos: (concertId: number, files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("photos", f);
    return request<{ photos: Photo[] }>(`/api/concerts/${concertId}/photos`, {
      method: "POST",
      body: form,
    });
  },
  deletePhoto: (id: number) => request<{ ok: true }>(`/api/photos/${id}`, { method: "DELETE" }),
};
