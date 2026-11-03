import { ApiError, type Branch, type HourRow } from './api';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export const money = (cents: number) => pesos.format(cents / 100);
export const whole = (value: number) => value.toLocaleString('es-MX');
export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
export const message = (e: unknown) => e instanceof ApiError ? e.message : 'Algo salió mal. Intenta de nuevo.';
export const plural = (n: number, one: string, many: string) => `${whole(n)} ${n === 1 ? one : many}`;

const DAY_MS = 86_400_000;
const iso = (at: number) => new Date(at).toISOString().slice(0, 10);

export const shiftDay = (date: string, days: number) => iso(Date.parse(date) + days * DAY_MS);

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export type Range = { from: string; to: string };

export const PERIODS: { id: Period; label: string; headline: string; before: string }[] = [
    { id: 'today', label: 'Hoy', headline: 'Ventas de hoy', before: 'ayer' },
    { id: 'yesterday', label: 'Ayer', headline: 'Ventas de ayer', before: 'el mismo día de la semana pasada' },
    { id: 'week', label: '7 días', headline: 'Ventas de los últimos 7 días', before: 'los 7 días anteriores' },
    { id: 'month', label: 'Este mes', headline: 'Ventas de este mes', before: 'los mismos días del mes pasado' },
    { id: 'custom', label: 'Fechas', headline: 'Ventas del periodo', before: 'el periodo anterior' }
];

/** The server answers at most this many days at once. */
export const MAX_DAYS = 366;

export const daysIn = ({ from, to }: Range) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;

export function range(period: Period, today: string, custom?: Range): Range {

    if (period === 'today') return { from: today, to: today };
    if (period === 'yesterday') { const day = shiftDay(today, -1); return { from: day, to: day }; }
    if (period === 'week') return { from: shiftDay(today, -6), to: today };
    if (period === 'custom' && custom) return custom;

    return { from: today.slice(0, 8) + '01', to: today };
}

/** The stretch the period is measured against. A single past day meets the same weekday, and the month runs from the 1st to the same day of the month before, cut at its end. */
export function previous(period: Period, current: Range): Range {

    if (period === 'yesterday') return { from: shiftDay(current.from, -7), to: shiftDay(current.to, -7) };

    if (period === 'month') {

        const [year, month, day] = current.to.split('-').map(Number) as [number, number, number];
        const start = Date.UTC(year, month - 2, 1);
        const last = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

        return { from: iso(start), to: iso(start + (Math.min(day, last) - 1) * DAY_MS) };

    }

    const length = daysIn(current);

    return { from: shiftDay(current.from, -length), to: shiftDay(current.from, -1) };
}

export const shortDate = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const rangeLabel = ({ from, to }: Range) => from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;

/** Percent change rounded to one decimal, or null when there is nothing to compare with. */
export const change = (now: number, before: number) => before ? Math.round((now - before) / Math.abs(before) * 1000) / 10 : null;
export const percent = (part: number, total: number) => total ? `${(Math.round(part / total * 1000) / 10).toLocaleString('es-MX')} %` : '—';

const METHODS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', platform: 'Plataformas', online: 'En línea' };
const CHANNELS: Record<string, string> = { table: 'Mesa', quick: 'Venta rápida', delivery: 'Domicilio', pickup: 'Para llevar', takeout: 'Para llevar', platform: 'Plataformas', staff: 'Comida de empleados' };

export const methodLabel = (method: string) => METHODS[method] ?? method;
export const channelLabel = (channel: string) => CHANNELS[channel] ?? channel;
export const clockTime = (at: string, timeZone?: string | null) => new Date(at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: timeZone ?? undefined });

/** Branches report the date they are living; before any report, the phone's own date minus the usual cutoff. */
export function todayOf(branches: Branch[], now = Date.now()) {

    return branches.map(b => b.businessDate).filter((d): d is string => d !== null).sort().at(-1) ?? new Date(now - 4 * 3_600_000).toLocaleDateString('en-CA');
}

export const cutoffHour = (branches: Branch[]) => Math.floor((branches.find(b => b.businessDayCutoffMinutes !== null)?.businessDayCutoffMinutes ?? 240) / 60);
/** Position inside the business day: with a 04:00 cutoff, 01:00 comes after 23:00. */
export const dayOrder = (hour: number, cutoff: number) => (hour - cutoff + 24) % 24;

export function clockHour(branches: Branch[], now = Date.now()) {

    const timeZone = branches.find(b => b.timeZone)?.timeZone ?? undefined;

    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
}

/** Sales of the hours already over, so a day in progress meets the same stretch of the day before. */
export function soFar(hours: HourRow[], clock: number, cutoff: number) {

    return hours.filter(h => dayOrder(h.hour, cutoff) < dayOrder(clock, cutoff)).reduce((total, h) => total + h.net, 0);
}

export function seenAt(at: string | null, now = Date.now()) {

    if (!at) return 'Nunca se ha conectado';

    const minutes = Math.max(0, Math.round((now - Date.parse(at)) / 60_000));

    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${plural(minutes, 'minuto', 'minutos')}`;
    if (minutes < 1440) return `Hace ${plural(Math.round(minutes / 60), 'hora', 'horas')}`;

    return `Hace ${plural(Math.round(minutes / 1440), 'día', 'días')}`;
}
