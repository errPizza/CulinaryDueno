import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleAlert, Equal } from 'lucide-react';
import type { Branch } from './api';
import { change, money, seenAt } from './format';

export type Row = { key: string; name: string; value: number; note?: ReactNode };

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A figure that climbs from the value it showed before, so a new sale is seen arriving. The first time it climbs from zero. */
export function useCountUp(value: number, ms = 900) {

    const [shown, setShown] = useState(still() ? value : 0);
    const from = useRef(still() ? value : 0);

    useEffect(() => {

        if (still() || from.current === value) { from.current = value; setShown(value); return; }

        const start = performance.now(), origin = from.current;
        let frame = 0;
        const step = (t: number) => {

            const k = Math.min(1, (t - start) / ms), eased = 1 - Math.pow(1 - k, 4);

            setShown(Math.round(origin + (value - origin) * eased));
            if (k < 1) frame = requestAnimationFrame(step); else from.current = value;

        };

        frame = requestAnimationFrame(step);

        return () => { cancelAnimationFrame(frame); from.current = value; };

    }, [value, ms]);

    return shown;
}

/**
 * A change against the earlier stretch as a pill: green when it went the good way, red when it went the bad way, grey when
 * nothing moved. `good` is 1 when going up is good (sales) and −1 when going down is (cancellations, discounts).
 */
export function Delta({ now, before, good = 1, shown = money, percent = false }: { now: number; before: number; good?: 1 | -1; shown?: (value: number) => string; percent?: boolean }) {

    const moved = now - before, kind = moved === 0 ? 'flat' : moved * good > 0 ? 'good' : 'bad';
    const Arrow = moved > 0 ? ArrowUpRight : moved < 0 ? ArrowDownRight : Equal;
    const rate = percent ? change(now, before) : null;

    return <span className={`pill ${kind}`}>

        <Arrow size={14} strokeWidth={2.5} aria-hidden="true" />
        {moved === 0 ? 'Igual' : `${moved > 0 ? '+' : '−'}${shown(Math.abs(moved))}`}{rate !== null && moved !== 0 && ` · ${moved > 0 ? '+' : '−'}${Math.abs(rate).toLocaleString('es-MX')} %`}

    </span>;
}

/** Lines of the closing slip: a name, its figure and a bar measured against the largest one, which carries the amber. */
export function Rows({ rows, shown = money, label }: { rows: Row[]; shown?: (value: number) => string; label?: string }) {

    const top = Math.max(...rows.map(r => r.value), 1);

    return <ol className="ranking" aria-label={label}>{rows.map(r => <li key={r.key} className={r.value === top ? 'top-row' : undefined}><div>

        <span className="rank-name">{r.name}</span>
        <span className="rank-net">{shown(r.value)}</span>
        <span className="rank-bar">{r.value > 0 && <span style={{ width: `${r.value / top * 100}%` }} />}</span>
        {r.note && <span className="rank-state">{r.note}</span>}

    </div></li>)}</ol>;
}

export function Facts({ items }: { items: [string, ReactNode][] }) {

    return <dl className="facts">{items.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}

/** Branches out of touch or never seen: their figure may be short, so every view says which ones. */
export function Behind({ rows, loadedAt }: { rows: Branch[]; loadedAt: number }) {

    return <>{rows.map(b => <p className="behind" key={b.licenseId}><CircleAlert size={16} /><span><b>{b.name}</b> {b.lastSeenAt ? `no reporta desde ${seenAt(b.lastSeenAt, loadedAt).toLowerCase()}. Su cifra puede estar incompleta.` : 'todavía no envía datos.'}</span></p>)}</>;
}

const list = new Intl.ListFormat('es', { type: 'conjunction' });

export const allLite = (branches: Branch[], lite: string[]) => branches.length > 0 && branches.every(b => lite.includes(b.licenseId));
export const branchNames =(branches: Branch[], ids: string[]) => list.format(ids.map(id => branches.find(b => b.licenseId === id)?.name ?? 'Una sucursal'));

/** Lite branches left out of the whole period, said under the headline so the consolidated figure is not read as everything. */
export function OutOfRange({ branches, ids }: { branches: Branch[]; ids: string[] }) {

    if (!ids.length) return null;

    return <p className="plan-note"><b>{branchNames(branches, ids)}</b> {ids.length === 1 ? 'no entra' : 'no entran'} en este periodo: con el plan Lite el panel muestra el mes en curso y los últimos 7 días.</p>;
}

/** Under a Pro figure: who it leaves out when the business mixes plans, or the whole area when every branch is Lite. */
export function ProNote({ branches, lite, locked }: { branches: Branch[]; lite: string[]; locked: string }) {

    if (!lite.length) return null;
    if (allLite(branches, lite)) return <p className="quiet">{locked} Pide a tu proveedor el cambio de plan.</p>;

    return <p className="plan-note">Sólo sucursales Pro: no incluye {branchNames(branches, lite)}.</p>;
}

export function Versus({ now, before, against }: { now: number; before: number; against: string }) {

    const moved = change(now, before);

    if (moved === null) return null;

    const said = moved === 0 ? `Lo mismo que ${against}` : `${Math.abs(moved).toLocaleString('es-MX')} % ${moved > 0 ? 'más' : 'menos'} que ${against}`;

    return <div className="versus"><Delta now={now} before={before} /><span>{said}: {money(now)} contra {money(before)}</span></div>;
}

export function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {

    return <section className={className ? `block ${className}` : 'block'}><h2>{title}</h2>{children}</section>;
}
