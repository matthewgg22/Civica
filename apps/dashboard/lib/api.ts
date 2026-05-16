const BASE = process.env.ENROLLMENT_API_URL ?? process.env.NEXT_PUBLIC_ENROLLMENT_API_URL ?? "http://localhost:8787";

async function apiFetch(path: string, jwt: string, init?: RequestInit) {
  const res = await fetch(`${BASE}/v1/enrollment${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  packets: {
    list: (jwt: string) => apiFetch("/packets", jwt),
    get: (jwt: string, id: string) => apiFetch(`/packets/${id}`, jwt),
    create: (jwt: string, body: unknown) =>
      apiFetch("/packets", jwt, { method: "POST", body: JSON.stringify(body) }),
    update: (jwt: string, id: string, body: unknown, transitionReason?: string) =>
      apiFetch(`/packets/${id}`, jwt, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: transitionReason ? { "X-Transition-Reason": transitionReason } : {},
      }),
    history: (jwt: string, id: string) => apiFetch(`/packets/${id}/history`, jwt),
  },
  answers: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/answers`, jwt),
    review: (jwt: string, answerId: string, body: unknown) =>
      apiFetch(`/answers/${answerId}/review`, jwt, { method: "PATCH", body: JSON.stringify(body) }),
  },
  documents: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/documents`, jwt),
  },
  notes: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/notes`, jwt),
    create: (jwt: string, packetId: string, body: unknown) =>
      apiFetch(`/packets/${packetId}/notes`, jwt, { method: "POST", body: JSON.stringify(body) }),
  },
};
