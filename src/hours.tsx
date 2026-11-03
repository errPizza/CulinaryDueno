import { useState } from 'react';
import type { HourRow, Summary } from './api';
import { dayOrder, hourLabel, money, plural, shiftDay, shortDate, whole, type Range } from './format';

type Column = { key: string; label: string; tick: string; net: number; tickets: number };

/** Neutral bars with one amber mark, the figure written above them instead of a floating tooltip, and a table for every chart. */
function Bars({ columns, mark, now, peakNote, head }: { columns: Column[]; mark: string | null; now?: string | null; peakNote: string; head: string }) {

    const [picked, setPicked] = useState<string | null>(null);
    const peak = columns.reduce((best, c) => c.net > best.net ? c : best, columns[0]!);
    const top = Math.max(peak.net, 1);
    const shown = columns.find(c => c.key === picked) ?? peak;
    const every = Math.ceil(columns.length / 7);

    return <figure className="hours">

        <figcaption aria-live="polite"><b>{shown.label}</b> {money(shown.net)} · {plural(shown.tickets, 'cuenta', 'cuentas')}{picked === null && ` · ${peakNote}`}</figcaption>
        <div className="hours-plot" onPointerLeave={() => setPicked(null)}>

            {columns.map(c => <button key={c.key} type="button" aria-label={`${c.label}: ${money(c.net)}, ${plural(c.tickets, 'cuenta', 'cuentas')}`} aria-pressed={picked === c.key} className={c.key === now ? 'now' : undefined} onPointerEnter={() => setPicked(c.key)} onFocus={() => setPicked(c.key)} onClick={() => setPicked(c.key)}>

                <span className={c.key === (mark ?? peak.key) ? 'bar mark' : 'bar'} style={{ height: `${Math.max(c.net / top * 100, c.net ? 2 : 0)}%` }} />

            </button>)}

        </div>
        <div className="hours-axis" aria-hidden="true">{columns.map((c, i) => <span key={c.key}>{i % every === 0 ? c.tick : ''}</span>)}</div>
        <details>

            <summary>Ver como tabla</summary>
            <table>

                <thead><tr><th scope="col">{head}</th><th scope="col">Ventas</th><th scope="col">Cuentas</th></tr></thead>
                <tbody>{columns.filter(c => c.tickets).map(c => <tr key={c.key}><td>{c.label}</td><td>{money(c.net)}</td><td>{whole(c.tickets)}</td></tr>)}</tbody>

            </table>

        </details>

    </figure>;
}

/** Sales by hour in the order the service lived them. The hour running today carries the mark, even before it sells; otherwise the peak does. */
export function Hours({ hours, cutoff, now }: { hours: HourRow[]; cutoff: number; now: number | null }) {

    const known = new Map(hours.map(h => [h.hour, h]));
    const ordered = hours.map(h => dayOrder(h.hour, cutoff));
    const running = now === null ? null : dayOrder(now, cutoff);
    const first = Math.min(...ordered, running ?? 24), last = Math.max(...ordered, running ?? 0);
    const columns = Array.from({ length: last - first + 1 }, (_, i) => {

        const hour = (first + i + cutoff) % 24, row = known.get(hour);

        return { key: String(hour), label: hourLabel(hour), tick: String(hour).padStart(2, '0'), net: row?.net ?? 0, tickets: row?.tickets ?? 0 };

    });
    const mark = now === null ? null : known.has(now) ? String(now) : '';

    return <Bars columns={columns} mark={mark} now={now === null ? null : String(now)} peakNote="hora pico" head="Hora" />;
}

const MONTHS_AFTER = 62;
const month = (key: string, style: 'long' | 'short') => new Date(key + '-15T12:00:00Z').toLocaleDateString('es-MX', style === 'long' ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' }).replace('.', '');

/** Sales by business day, with the days without sales shown empty. Past two months a bar per day is too thin, so it groups by month. */
export function Days({ days, span }: { days: Summary['days']; span: Range }) {

    const known = new Map(days.map(d => [d.businessDate, d]));
    const dates: string[] = [];

    for (let day = span.from; day <= span.to; day = shiftDay(day, 1)) dates.push(day);

    if (dates.length <= MONTHS_AFTER) return <Bars columns={dates.map(date => ({ key: date, label: shortDate(date), tick: String(Number(date.slice(8))), net: known.get(date)?.net ?? 0, tickets: known.get(date)?.tickets ?? 0 }))} mark={null} peakNote="mejor día" head="Día" />;

    const months = new Map<string, Column>();

    for (const date of dates) {

        const key = date.slice(0, 7), row = known.get(date);
        const sum = months.get(key) ?? { key, label: month(key, 'long'), tick: month(key, 'short'), net: 0, tickets: 0 };

        months.set(key, { ...sum, net: sum.net + (row?.net ?? 0), tickets: sum.tickets + (row?.tickets ?? 0) });

    }

    return <Bars columns={[...months.values()]} mark={null} peakNote="mejor mes" head="Mes" />;
}
