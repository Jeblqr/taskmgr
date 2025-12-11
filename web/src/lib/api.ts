export const API_BASE = "http://localhost:3000/api";

export async function fetcher(url: string) {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
