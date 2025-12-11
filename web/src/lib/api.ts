export const API_BASE = "/api";

export async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem("auth_token");
    const headers = {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }

    return res;
}

export async function fetcher(url: string) {
  const res = await authenticatedFetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
