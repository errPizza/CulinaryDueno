export type Live = {

    at: string; openAccounts: number; occupiedTables: number; openAmount: number; pendingRequests: number; cashOpen: boolean; lowStock: { ingredientId: string; name: string; unit: string; available: number; min: number }[];
    // Sent by branches from schema 2 on; older branches leave them out.
    tables?: { total: number; free: number; occupied: number; cleaning: number; reserved: number }; partial?: { count: number; paid: number }; onClock?: { people: number; hourlyCost: number };

};
export type Branch = {

    licenseId: string; name: string; tier: 'lite' | 'pro'; licenseStatus: 'pending' | 'active' | 'expired' | 'revoked'; lastSeenAt: string | null; stale: boolean;
    timeZone: string | null; businessDate: string | null; businessDayCutoffMinutes: number | null; lastZ: number | null; appVersion: string | null; live: Live | null;

};
export type Totals = { tickets: number; people: number; gross: number; discounts: number; net: number; tax: number; deliveryFees: number; voidedCount: number; voidedAmount: number; comps: number; staffMeals: number; averageTicket: number; averagePerson: number };
export type HourRow = { hour: number; tickets: number; net: number; people?: number };
/** Lite branches never enter a Pro figure; `outOfRange` were left out whole because the period starts before what Lite reads. */
export type Marks = { lite: string[]; outOfRange: string[] };
export type Summary = Marks & {

    from: string; to: string; totals: Totals; partial: string[]; branches: (Branch & Totals & { hasData: boolean; openDays: number })[];
    days: { businessDate: string; tickets: number; net: number }[]; hours: HourRow[];
    channels: { channel: string; tickets: number; net: number }[];
    payments: { method: string; amount: number; tips: number; count: number }[];
    refunds: { method: string; amount: number; count: number }[];
    areas?: { area: string; tickets: number; people: number; net: number }[];
    shifts?: { name: string; start: number; end: number; tickets: number; people: number; net: number; averageTicket: number }[];

};
type Range = Marks & { from: string; to: string };
export type Products = Range & { products: { name: string; category: string; quantity: number; revenue: number; cost: number; revenueWithoutCost: number; estimatedMargin: number }[] };
export type Staff = Range & { staff: { licenseId: string; branchName?: string; staffId: string; name: string; tickets: number; net: number; tips: number }[] };
export type Cash = Range & {

    cash: { income: number; expense: number; withdrawal: number }; inventory: { waste: number; shortage: number; surplus: number };
    closes: { licenseId: string; businessDate: string; cashId: string; closedAt: string; blind: boolean; cashDifference: number; cardDifference: number; transferDifference: number; adjustments: number }[];

};
export type Closings = Range & { closings: { licenseId: string; branchName?: string; businessDate: string; number: number; from: string; to: string; tickets: number; net: number; panelTickets: number; panelNet: number; reopenedTickets: number; reopenedNet: number }[] };
export type Goal = { licenseId: string; branchName: string | null; period: 'day' | 'month' | 'year'; from: string; to: string; target: number; actual: number; tickets: number; progressBps: number; expected: number; projected: number; pace: 'reached' | 'open' | 'ahead' | 'close' | 'behind'; outOfRange: string[] };
export type Goals = { today: string; goals: Goal[] };
export type Trend = Range & { by: 'week' | 'month' | 'year'; periods: { key: string; from: string; to: string; tickets: number; people: number; net: number; days: number; lastYearNet: number; lastYearTickets: number; averageTicket: number; growthBps: number | null }[]; total: number; lastYearTotal: number; hasLastYear: boolean };
export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog';
export type CostAlert = { licenseId: string; branchName?: string; ingredientId: string; name: string; unit: string; before: number; after: number; changeBps: number; at: string; products: { name: string; price: number; cost: number | null }[] };
export type Expiring = { licenseId: string; branchName?: string; ingredientId: string; name: string; unit: string; quantity: number; cost: number; expiresOn: string; days: number; products: string[] };
export type Menu = Range & {

    foodCostTargetBps: number; kinds: { kind: string; quantity: number; revenue: number }[];
    items: { name: string; category: string; quantity: number; revenue: number; cost: number; unitMargin: number; shareBps: number; foodCostBps: number; price: number; suggestedPrice: number | null; class: MenuClass; advice: string }[];
    thresholds: { popularShareBps: number; averageMargin: number }; uncosted: { name: string; category: string; revenue: number }[];
    totals: { revenue: number; costedRevenue: number; cost: number; foodCostBps: number };
    weekdays: { weekday: number; days: number; average: number }[]; slowDays: { weekday: number; days: number; average: number; belowBps: number }[]; peakHours: { hour: number; net: number; aboveBps: number }[];
    costAlerts: CostAlert[]; expiring: Expiring[];

};
export type Profit = Range & {

    net: number; tax: number; sales: number; cogs: number; revenueWithoutCost: number; waste: number; expenses: { account: string; amount: number; count: number }[]; expensesTotal: number;
    labor: { minutes: number; cost: number; counted: boolean }; fixed: { licenseId: string; name: string; monthly: number; amount: number }[]; fixedTotal: number; profit: number; marginBps: number; foodCostBps: number; laborBps: number;

};
export type TeamRow = { licenseId: string; branchName?: string; staffId: string; name: string; role: string; tickets: number; net: number; tips: number; people: number; tables: number; voids: number; voidAmount: number; discounts: number; discountAmount: number; rejected: number; reopens: number; drawerOpens: number; minutes: number; laborCost: number; averageTicket: number; salesPerHour: number | null };
export type Team = Range & {

    laborTargetBps: number; staff: TeamRow[]; couriers: { licenseId: string; branchName?: string; courierId: string; name: string; deliveries: number; net: number }[];
    labor: { minutes: number; cost: number; net: number; laborBps: number; byHour: { hour: number; net: number; minutes: number; cost: number; laborBps: number }[]; now: { people: number; hourlyCost: number } };
    tips: { total: number; minutes: number; shares: { licenseId: string; staffId: string; name: string; branchName?: string; minutes: number; share: number }[] };
    anomalies: { licenseId: string; branchName?: string; staffId: string; name: string; metric: string; label: string; value: number; usual: number; amount: number }[];
    schedule: { weekday: number; hour: number; expectedNet: number; currentPeople: number; suggestedPeople: number }[]; averageWage: number;
    roster: { active: number; months: { month: string; hires: number; exits: number; headcount: number }[]; hires: number; exits: number; turnoverBps: number };

};
export type Kitchen = Range & {

    totals: { dishes: number; averageSeconds: number; returns: number; returnBps: number };
    dishes: { name: string; station: string; count: number; averageSeconds: number; averagePrep: number; averageWait: number; averagePass: number | null; maxSeconds: number }[];
    stations: { station: string; count: number; averageSeconds: number; maxSeconds: number }[];
    returns: { name: string; count: number; sold: number; rateBps: number; reasons: { reason: string; label: string; count: number }[] }[];
    reasons: { reason: string; label: string; count: number }[];
    promises: { mode: string; count: number; late: number; onTimeBps: number; averagePromised: number; averageActual: number }[];

};
export type Customers = Range & {

    period: { tickets: number; net: number; identifiedTickets: number; identifiedNet: number; first: number; repeat: number; identifiedBps: number; averageIdentified: number };
    known: { identified: number; active90: number; repeat90: number; averageGapDays: number; lifetimeAverage: number; visitsAverageTenths: number; vip: number; vipLapsed: number; lapsedDays: number };
    reviews: { count: number; foodTenths: number; serviceTenths: number; overallTenths: number; low: number };
    best: { name: string; count: number; averageTenths: number }[]; worst: { name: string; count: number; averageTenths: number }[];

};
export type ForecastDay = { date: string; weekday: number; weeks: number; base: number; net: number; tickets: number; low: number; high: number; trend: number; holiday: { name: string; factor: number; learned: boolean } | null; weather: { rainMm: number; rainChance: number; maxC: number; wet: boolean; factor: number } | null; factor: number };
export type Forecast = Marks & { today: string; trend: number; errorBps: number | null; historyDays: number; weather: { label: string; used: boolean; rainFactor: number; learned: boolean } | null; days: ForecastDay[]; products: { name: string; days: { date: string; units: number }[] }[] };
export type Alert = { level: 'high' | 'medium' | 'info'; area: string; title: string; detail: string; licenseId: string | null; branchName: string | null };
export type Alerts = { today: string; alerts: Alert[] };
export type Settings = {

    shifts: { name: string; start: number }[]; goals: { licenseId: string; period: 'day' | 'month' | 'year'; amount: number }[]; fixedCosts: { licenseId: string; name: string; monthly: number }[];
    foodCostTargetBps: number; laborTargetBps: number; countClockLabor: boolean; locations: { licenseId: string; label: string; lat: number; lon: number }[];

};
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
export const menu = stats<Menu>('menu');
export const profit = stats<Profit>('profit');
export const team = stats<Team>('team');
export const kitchen = stats<Kitchen>('kitchen');
export const customers = stats<Customers>('customers');
export const trend = (from: string, to: string, by: Trend['by'], branch?: string) => request<Trend>('GET', `/owner/v1/stats/trend?from=${from}&to=${to}&by=${by}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`);
const byBranch = <T>(path: string) => (branch?: string) => request<T>('GET', `/owner/v1/stats/${path}${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`);
export const goals = byBranch<Goals>('goals');
export const forecast = byBranch<Forecast>('forecast');
export const alerts = byBranch<Alerts>('alerts');
export const settings = () => request<{ settings: Settings; canEdit: boolean }>('GET', '/owner/v1/settings');
export const saveSettings = (value: Settings) => request<{ settings: Settings; canEdit: boolean }>('PUT', '/owner/v1/settings', value);
export const geocode = (q: string) => request<{ places: { label: string; lat: number; lon: number }[] }>('GET', `/owner/v1/geocode?q=${encodeURIComponent(q)}`);
