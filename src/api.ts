export type Live = { at: string; openAccounts: number; occupiedTables: number; openAmount: number; pendingRequests: number; cashOpen: boolean; lowStock: { ingredientId: string; name: string; unit: string; available: number; min: number }[] };
export type Branch = {

    licenseId: string; name: string; tier: 'lite' | 'pro'; licenseStatus: 'pending' | 'active' | 'expired' | 'revoked'; lastSeenAt: string | null; stale: boolean;
    timeZone: string | null; businessDate: string | null; businessDayCutoffMinutes: number | null; lastZ: number | null; appVersion: string | null; live: Live | null;

};
export type Totals = { tickets: number; people: number; gross: number; discounts: number; net: number; tax: number; deliveryFees: number; voidedCount: number; voidedAmount: number; comps: number; staffMeals: number; averageTicket: number; averagePerson: number };
export type HourRow = { hour: number; tickets: number; net: number };
/** Lite branches never enter a Pro figure; `outOfRange` were left out whole because the period starts before what Lite reads. */
export type Marks = { lite: string[]; outOfRange: string[] };
export type Summary = Marks & {

    from: string; to: string; totals: Totals; partial: string[]; branches: (Branch & Totals & { hasData: boolean; openDays: number })[];
    days: { businessDate: string; tickets: number; net: number }[]; hours: HourRow[];
    channels: { channel: string; tickets: number; net: number }[];
    payments: { method: string; amount: number; tips: number; count: number }[];
    refunds: { method: string; amount: number; count: number }[];

};
type Range = Marks & { from: string; to: string };
export type Products = Range & { products: { name: string; category: string; quantity: number; revenue: number; cost: number; revenueWithoutCost: number; estimatedMargin: number }[] };
export type Staff = Range & { staff: { licenseId: string; branchName?: string; staffId: string; name: string; tickets: number; net: number; tips: number }[] };
export type Cash = Range & {

    cash: { income: number; expense: number; withdrawal: number }; inventory: { waste: number; shortage: number; surplus: number };
    closes: { licenseId: string; businessDate: string; cashId: string; closedAt: string; blind: boolean; cashDifference: number; cardDifference: number; transferDifference: number; adjustments: number }[];

};
export type Closings = Range & { closings: { licenseId: string; branchName?: string; businessDate: string; number: number; from: string; to: string; tickets: number; net: number; panelTickets: number; panelNet: number; reopenedTickets: number; reopenedNet: number }[] };
export type Me = { account: { id: string; email: string; role: 'owner' | 'manager' }; branches: Branch[] };

export class ApiError extends Error {

    constructor(public status: number, public code: string, message: string) { super(message); }

}

const SESSION = 'culinary-dueno-session', CHOSEN_SERVER = 'culinary-dueno-server';
const BUILT_SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';

/** Fixed when the installer was built for one provider; otherwise asked once on the first start. */
export function serverUrl(): string {

    try { return BUILT_SERVER || localStorage.getItem(CHOSEN_SERVER) || ''; } catch { return BUILT_SERVER; }
}

export function chooseServer(url: string) {

    const parsed = new URL(url.trim());

    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.username) throw new ApiError(400, 'bad_request', 'Escribe la dirección HTTPS que te dio tu proveedor, sin ruta, por ejemplo https://culinary-server.ejemplo.workers.dev');

    localStorage.setItem(CHOSEN_SERVER, parsed.origin);
}
const signedOut = new Set<() => void>();

export const onSignedOut = (listener: () => void) => { signedOut.add(listener); return () => { signedOut.delete(listener); }; };

// The WebView's private storage: the session has to survive closing the app, and it reads summaries only.
export function session(): string | null {

    try {

        const saved = JSON.parse(localStorage.getItem(SESSION) ?? 'null') as { token: string; expiresAt: string } | null;

        return saved && Date.parse(saved.expiresAt) > Date.now() ? saved.token : null;

    } catch { return null; }

}

function forget() { try { localStorage.removeItem(SESSION); } catch { /* nothing kept */ } }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {

    const token = session();
    let response: Response;

    try {

        response = await fetch(serverUrl() + path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

    } catch { throw new ApiError(0, 'offline', 'No hay conexión con Culinary. Revisa tu internet e intenta de nuevo.'); }

    const data = await response.json().catch(() => ({})) as T & { error?: { code: string; message: string } };

    if (response.ok) return data;
    if (response.status === 401 && token) { forget(); signedOut.forEach(listener => listener()); }

    throw new ApiError(response.status, data.error?.code ?? 'error', data.error?.message ?? 'Culinary no pudo responder. Intenta de nuevo.');
}

export async function login(email: string, password: string, totp: string) {

    const reply = await request<{ token: string; expiresAt: string }>('POST', '/owner/v1/login', { email, password, totp });

    localStorage.setItem(SESSION, JSON.stringify(reply));
}

export async function logout() {

    try { await request('POST', '/owner/v1/logout', {}); } finally { forget(); signedOut.forEach(listener => listener()); }
}

export const enroll = (code: string, password: string) => request<{ email: string; totp: { secret: string; uri: string } }>('POST', '/owner/v1/enroll', { code: code.trim(), password });
export const confirmEnroll = (email: string, password: string, totp: string) => request<{ email: string }>('POST', '/owner/v1/enroll/confirm', { email, password, totp });
export const me = () => request<Me>('GET', '/owner/v1/me');
const stats = <T>(path: string) => (from: string, to: string, branch?: string) => request<T>('GET', `/owner/v1/stats/${path}?from=${from}&to=${to}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`);

export const summary = stats<Summary>('summary');
export const products = stats<Products>('products');
export const staff = stats<Staff>('staff');
export const cash = stats<Cash>('cash');
export const closings = stats<Closings>('closings');
