import Constants from "expo-constants";

function baseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  const b = (env || extra || "http://localhost:3000").replace(/\/$/, "");
  return b;
}

export { baseUrl as getBaseUrl };

export async function apiFetch(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, headers, ...rest } = opts;
  const h: HeadersInit = {
    Accept: "application/json",
    ...(headers || {}),
  };
  if (!(rest.body instanceof FormData) && !(h as Record<string, string>)["Content-Type"]) {
    (h as Record<string, string>)["Content-Type"] = "application/json";
  }
  if (token) (h as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  return fetch(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`, { ...rest, headers: h });
}

export async function apiJson<T>(path: string, opts: Parameters<typeof apiFetch>[1] = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  return (await res.json()) as T;
}
