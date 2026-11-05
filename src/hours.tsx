import { useState } from 'react';
import type { HourRow, Summary } from './api';
import { dayOrder, hourLabel, money, plural, shiftDay, shortDate, whole, type Range } from './format';

type Column = { key: string; label: string; tick: string; value: number; tickets: number; ghost?: number | null };
export type Metric = 'net' | 'tickets' | 'people';

export const METRICS: { id: Metric; label: string; shown: (value: number) => string }[] = [
    { id: 'net', label: 'Ventas', shown: money },
    { id: 'tickets', label: 'Cuentas', shown: whole },
    { id: 'people', label: 'Comensales', shown: whole }
];

/**
 * Bars with one amber mark and, when there is an earlier stretch, its outline behind each bar. The figure is written above
 * the bars instead of a floating tooltip, so a finger never covers it, and every chart has a table.
 */
function Bars({ columns, mark, now, peakNote, head, shown = money, valueLabel = 'Ventas', ghostLabel }: { columns: Column[]; mark: string | null; now?: string | null; peakNote: string; head: string; shown?: (value: number) => string; valueLabel?: string; ghostLabel?: string }) {

    const [picked, setPicked] = useState<string | null>(null);
    const peak = columns.reduce((best, c) => c.value > best.value ? c : best, columns[0]!);
    const top = Math.max(peak.value, ...columns.map(c => c.ghost ?? 0), 1);
    const current = columns.find(c => c.key === picked) ?? peak;
    const every = Math.ceil(columns.length / 7);
    const ghosts = ghostLabel !== undefined && columns.some(c => c.ghost);
    const none = columns.every(c => !c.value && !c.tickets);

    return <figure className="hours">

        <div className="hours-head">

            <figcaption aria-live="polite">{none && picked === null ? <>Sin ventas cerradas en este periodo{ghosts ? '.' : ''}</> : <><b>{current.label}</b> {shown(current.value)} · {plural(current.tickets, 'cuenta', 'cuentas')}{picked === null && ` · ${peakNote}`}</>}{ghosts && current.ghost != null && <span className="was"> · {ghostLabel.toLowerCase()} {shown(current.ghost)}</span>}</figcaption>
            {ghosts && <span className="hours-key" aria-hidden="true"><span><i className="now-key" />{valueLabel}</span><span><i className="was-key" />{ghostLabel}</span></span>}

        </div>
        <div className="hours-plot" onPointerLeave={() => setPicked(null)}>

            {columns.map(c => <button key={c.key} type="button" aria-label={`${c.label}: ${shown(c.value)}, ${plural(c.tickets, 'cuenta', 'cuentas')}`} aria-pressed={picked === c.key} className={c.key === now ? 'now' : undefined} onPointerEnter={() => setPicked(c.key)} onFocus={() => setPicked(c.key)} onClick={() => setPicked(c.key)}>

                {ghosts && c.ghost ? <span className="was-bar" style={{ height: `${c.ghost / top * 100}%` }} /> : null}
                <span className={c.key === (mark ?? peak.key) ? 'bar mark' : 'bar'} style={{ height: `${Math.max(c.value / top * 100, c.value ? 2 : 0)}%` }} />

            </button>)}

        </div>
        <div className="hours-axis" aria-hidden="true">{columns.map((c, i) => <span key={c.key}>{i % every === 0 ? c.tick : ''}</span>)}</div>
        {!none && <details>

            <summary>Ver como tabla</summary>
            <table>

                <thead><tr><th scope="col">{head}</th><th scope="col">{valueLabel}</th>{ghosts && <th scope="col">{ghostLabel}</th>}<th scope="col">Cuentas</th></tr></thead>
                <tbody>{columns.filter(c => c.tickets).map(c => <tr key={c.key}><td>{c.label}</td><td>{shown(c.value)}</td>{ghosts && <td>{c.ghost == null ? '—' : shown(c.ghost)}</td>}<td>{whole(c.tickets)}</td></tr>)}</tbody>

            </table>

        </details>}

    </figure>;
}

const read = (row: HourRow | undefined, metric: Metric) => row ? metric === 'people' ? row.people ?? 0 : row[metric] : 0;

/**
 * Sales by hour in the order the service lived them. The hour running today carries the mark, even before it sells;
 * otherwise the peak does. `before` draws the earlier stretch's hours as outlines behind the bars.
 */
export function Hours({ hours, cutoff, now, metric = 'net', before, beforeLabel }: { hours: HourRow[]; cutoff: number; now: number | null; metric?: Metric; before?: HourRow[]; beforeLabel?: string }) {

    const known = new Map(hours.map(h => [h.hour, h]));
    const earlier = new Map((before ?? []).map(h => [h.hour, h]));
    const ordered = hours.map(h => dayOrder(h.hour, cutoff));
    const running = now === null ? null : dayOrder(now, cutoff);
    // A day without sales still shows the usual service, 08:00 to 23:00, around the hour running.
    const usual = ordered.length ? [] : [dayOrder(8, cutoff), dayOrder(23, cutoff)];
    const first = Math.min(...ordered, ...usual, running ?? 24), last = Math.max(...ordered, ...usual, running ?? 0);
    const columns = Array.from({ length: last - first + 1 }, (_, i) => {

        const hour = (first + i + cutoff) % 24, row = known.get(hour);

        return { key: String(hour), label: hourLabel(hour), tick: String(hour).padStart(2, '0'), value: read(row, metric), tickets: row?.tickets ?? 0, ghost: before ? earlier.has(hour) ? read(earlier.get(hour), metric) : null : undefined };

    });
    const mark = now === null ? null : known.has(now) ? String(now) : '';
    const { label, shown } = METRICS.find(m => m.id === metric)!;

    return <Bars columns={columns} mark={mark} now={now === null ? null : String(now)} peakNote="hora pico" head="Hora" shown={shown} valueLabel={label} ghostLabel={before ? beforeLabel : undefined} />;
}

const MONTHS_AFTER = 62;
const month = (key: string, style: 'long' | 'short') => new Date(key + '-15T12:00:00Z').toLocaleDateString('es-MX', style === 'long' ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' }).replace('.', '');

/** Sales by business day, with the days without sales shown empty. Past two months a bar per day is too thin, so it groups by month. */
export function Days({ days, span }: { days: Summary['days']; span: Range }) {

    const known = new Map(days.map(d => [d.businessDate, d]));
    const dates: string[] = [];

    for (let day = span.from; day <= span.to; day = shiftDay(day, 1)) dates.push(day);

    if (dates.length <= MONTHS_AFTER) return <Bars columns={dates.map(date => ({ key: date, label: shortDate(date), tick: String(Number(date.slice(8))), value: known.get(date)?.net ?? 0, tickets: known.get(date)?.tickets ?? 0 }))} mark={null} peakNote="mejor día" head="Día" />;

    const months = new Map<string, Column>();

    for (const date of dates) {

        const key = date.slice(0, 7), row = known.get(date);
        const sum = months.get(key) ?? { key, label: month(key, 'long'), tick: month(key, 'short'), value: 0, tickets: 0 };

        months.set(key, { ...sum, value: sum.value + (row?.net ?? 0), tickets: sum.tickets + (row?.tickets ?? 0) });

    }

    return <Bars columns={[...months.values()]} mark={null} peakNote="mejor mes" head="Mes" />;
}
