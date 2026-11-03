import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleAlert, Equal } from 'lucide-react';
import type { Branch } from './api';
import { change, money, seenAt } from './format';

export type Row = { key: string; name: string; value: number; note?: ReactNode };

/** Lines of the closing slip: a name, its figure and a bar measured against the largest one. */
export function Rows({ rows, shown = money, label }: { rows: Row[]; shown?: (value: number) => string; label?: string }) {

    const top = Math.max(...rows.map(r => r.value), 1);

    return <ol className="ranking" aria-label={label}>{rows.map(r => <li key={r.key}><div>

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

    const Arrow = moved > 0 ? ArrowUpRight : moved < 0 ? ArrowDownRight : Equal;
    const said = moved === 0 ? `Lo mismo que ${against}` : `${Math.abs(moved).toLocaleString('es-MX')} % ${moved > 0 ? 'más' : 'menos'} que ${against}`;

    return <p className="versus"><Arrow size={18} aria-hidden="true" /><span>{said}: {money(now)} contra {money(before)}</span></p>;
}

export function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {

    return <section className={className ? `block ${className}` : 'block'}><h2>{title}</h2>{children}</section>;
}
