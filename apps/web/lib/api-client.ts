const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return sessionStorage.getItem("payflow_token");
    } catch {
        return null;
    }
}

export function setStoredToken(token: string | null): void {
    if (typeof window === "undefined") return;
    try {
        if (token) sessionStorage.setItem("payflow_token", token);
        else sessionStorage.removeItem("payflow_token");
    } catch { /* ignore */ }
}

async function request<T>(method: string, path: string, options?: {
    body?: unknown;
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
}): Promise<T> {
    let url = `${BASE_URL}${path}`;
    if (options?.params) {
        const qs = new URLSearchParams(
            Object.entries(options.params)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])
        ).toString();
        if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json", ...(options?.headers ?? {}) };
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
    }

    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || `Request failed: ${res.status}`);
    }

    return res.json() as Promise<T>;
}

const apiClient = {
    get: <T>(path: string, options?: { params?: Record<string, unknown>; headers?: Record<string, string> }) =>
        request<T>("GET", path, options),
    post: <T>(path: string, body?: unknown, options?: { headers?: Record<string, string> }) =>
        request<T>("POST", path, { body, headers: options?.headers }),
    put: <T>(path: string, body?: unknown) =>
        request<T>("PUT", path, { body }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>("PATCH", path, { body }),
    delete: <T>(path: string) =>
        request<T>("DELETE", path),
};

export { apiClient };
export default apiClient;
