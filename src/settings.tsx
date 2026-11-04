import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import * as api from './api';
import type { View } from './app';
import { message, money } from './format';
import { Block } from './parts';

// How the panel reads the business: shifts, goals, fixed costs, targets and where each branch is. Nothing here reaches
// a branch. Only the owner saves; a manager sees the same values.

const PERIODS = [{ id: 'day', label: 'Diaria' }, { id: 'month', label: 'Mensual' }, { id: 'year', label: 'Anual' }] as const;
const pesos = (cents: number) => cents ? String(cents / 100) : '';
const cents = (text: string) => Math.round(Number(text.replace(/[^\d.]/g, '')) * 100) || 0;

export function SettingsView({ view, data }: { view: View; data: { settings: api.Settings; canEdit: boolean } }) {

    const [draft, setDraft] = useState(data.settings), [saved, setSaved] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [query, setQuery] = useState<Record<string, string>>({}), [places, setPlaces] = useState<Record<string, { label: string; lat: number; lon: number }[]>>({});
    const branches = view.me.branches, edit = data.canEdit;
    const set = (change: Partial<api.Settings>) => { setDraft(d => ({ ...d, ...change })); setSaved(''); };
    const scope = (value: string, choose: (id: string) => void, label: string) => <select aria-label={label} value={value} disabled={!edit} onChange={e => choose(e.target.value)}><option value="">Todas las sucursales</option>{branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}</select>;
    const save = async () => {

        setBusy(true); setError('');

        try { const reply = await api.saveSettings(draft); setDraft(reply.settings); setSaved('Ajustes guardados. Las cifras ya los usan.'); } catch (e) { setError(message(e)); } finally { setBusy(false); }

    };
    const find = async (licenseId: string) => {

        setError('');

        try { const { places: found } = await api.geocode(query[licenseId] ?? ''); setPlaces(p => ({ ...p, [licenseId]: found })); if (!found.length) setError('No se encontró esa ciudad. Prueba con otro nombre.'); } catch (e) { setError(message(e)); }

    };

    return <main className="report settings">

        <section className="headline" aria-label="Ajustes del panel">

            <h1>Ajustes del panel</h1>
            <p className="lead">Cambian cómo se leen las cifras, no la sucursal.</p>
            {!edit && <p className="plan-note">Sólo el dueño puede cambiarlos.</p>}

        </section>
        <div className="col">

            <Block title="Turnos">

                <p className="note first">Cada turno va de su hora de inicio a la del siguiente; el último pasa la medianoche.</p>
                {draft.shifts.map((s, i) => <div className="setting-row" key={i}>

                    <label className="field">Nombre<input value={s.name} maxLength={40} disabled={!edit} onChange={e => set({ shifts: draft.shifts.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /></label>
                    <label className="field">Empieza<select value={s.start} disabled={!edit} onChange={e => set({ shifts: draft.shifts.map((x, j) => j === i ? { ...x, start: Number(e.target.value) } : x) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
                    {edit && draft.shifts.length > 1 && <button className="icon-button" aria-label={`Quitar el turno ${s.name}`} onClick={() => set({ shifts: draft.shifts.filter((_, j) => j !== i) })}><Trash2 size={18} /></button>}

                </div>)}
                {edit && draft.shifts.length < 6 && <button className="ghost" onClick={() => set({ shifts: [...draft.shifts, { name: 'Turno', start: (Math.max(...draft.shifts.map(s => s.start)) + 1) % 24 }] })}><Plus size={18} />Agregar turno</button>}

            </Block>
            <Block title="Metas de venta">

                {draft.goals.map((g, i) => <div className="setting-row" key={i}>

                    <label className="field">Sucursal{scope(g.licenseId, id => set({ goals: draft.goals.map((x, j) => j === i ? { ...x, licenseId: id } : x) }), 'Sucursal de la meta')}</label>
                    <label className="field">Periodo<select value={g.period} disabled={!edit} onChange={e => set({ goals: draft.goals.map((x, j) => j === i ? { ...x, period: e.target.value as api.Goal['period'] } : x) })}>{PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                    <label className="field">Meta en pesos<input inputMode="decimal" value={pesos(g.amount)} disabled={!edit} onChange={e => set({ goals: draft.goals.map((x, j) => j === i ? { ...x, amount: cents(e.target.value) } : x) })} /></label>
                    {edit && <button className="icon-button" aria-label="Quitar meta" onClick={() => set({ goals: draft.goals.filter((_, j) => j !== i) })}><Trash2 size={18} /></button>}

                </div>)}
                {!draft.goals.length && <p className="quiet">Sin metas.</p>}
                {edit && <button className="ghost" onClick={() => set({ goals: [...draft.goals, { licenseId: '', period: 'month', amount: 0 }] })}><Plus size={18} />Agregar meta</button>}

            </Block>
            <Block title="Gastos fijos mensuales">

                <p className="note first">Renta, nómina fija, mantenimiento, servicios. Se reparten por los días del periodo en Rentabilidad. Uno de «Todas» sólo cuenta al ver todo el negocio.</p>
                {draft.fixedCosts.map((f, i) => <div className="setting-row" key={i}>

                    <label className="field">Sucursal{scope(f.licenseId, id => set({ fixedCosts: draft.fixedCosts.map((x, j) => j === i ? { ...x, licenseId: id } : x) }), 'Sucursal del gasto')}</label>
                    <label className="field">Concepto<input value={f.name} maxLength={80} disabled={!edit} onChange={e => set({ fixedCosts: draft.fixedCosts.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /></label>
                    <label className="field">Al mes<input inputMode="decimal" value={pesos(f.monthly)} disabled={!edit} onChange={e => set({ fixedCosts: draft.fixedCosts.map((x, j) => j === i ? { ...x, monthly: cents(e.target.value) } : x) })} /></label>
                    {edit && <button className="icon-button" aria-label={`Quitar ${f.name}`} onClick={() => set({ fixedCosts: draft.fixedCosts.filter((_, j) => j !== i) })}><Trash2 size={18} /></button>}

                </div>)}
                {draft.fixedCosts.length > 0 && <p className="note">Total al mes: {money(draft.fixedCosts.reduce((t, f) => t + f.monthly, 0))}</p>}
                {edit && <button className="ghost" onClick={() => set({ fixedCosts: [...draft.fixedCosts, { licenseId: '', name: 'Renta', monthly: 0 }] })}><Plus size={18} />Agregar gasto fijo</button>}

            </Block>

        </div>
        <div className="col">

            <Block title="Metas de costo">

                <div className="setting-row">

                    <label className="field">Costo de alimentos, %<input inputMode="decimal" value={draft.foodCostTargetBps / 100} disabled={!edit} onChange={e => set({ foodCostTargetBps: Math.round(Number(e.target.value) * 100) || 0 })} /><small>Sobre el precio. Arriba de esto se sugiere un precio nuevo.</small></label>
                    <label className="field">Costo laboral, %<input inputMode="decimal" value={draft.laborTargetBps / 100} disabled={!edit} onChange={e => set({ laborTargetBps: Math.round(Number(e.target.value) * 100) || 0 })} /><small>Sobre ventas. Arriba de esto avisa que sobra personal.</small></label>

                </div>
                <label className="check"><input type="checkbox" checked={draft.countClockLabor} disabled={!edit} onChange={e => set({ countClockLabor: e.target.checked })} />Restar las horas del reloj checador en Rentabilidad</label>
                <p className="note">Desactívalo si la nómina ya se registra como gasto en la sucursal, para no restarla dos veces.</p>

            </Block>
            <Block title="Ubicación para el clima">

                <p className="note first">El pronóstico usa el clima de Open-Meteo. Sólo se guardan las coordenadas.</p>
                {branches.map(b => { const at = draft.locations.find(l => l.licenseId === b.licenseId); return <div className="place" key={b.licenseId}>

                    <b>{b.name}</b>
                    <span className="quiet">{at ? at.label : 'Sin ubicación'}</span>
                    {edit && <div className="setting-row">

                        <label className="field">Ciudad<input value={query[b.licenseId] ?? ''} placeholder="Ej. Monterrey" onChange={e => setQuery(q => ({ ...q, [b.licenseId]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') void find(b.licenseId); }} /></label>
                        <button className="ghost" onClick={() => void find(b.licenseId)} disabled={(query[b.licenseId] ?? '').trim().length < 2}><Search size={18} />Buscar</button>
                        {at && <button className="icon-button" aria-label={`Quitar la ubicación de ${b.name}`} onClick={() => set({ locations: draft.locations.filter(l => l.licenseId !== b.licenseId) })}><Trash2 size={18} /></button>}

                    </div>}
                    {(places[b.licenseId] ?? []).length > 0 && <ul className="choices">{places[b.licenseId]!.map(p => <li key={`${p.lat},${p.lon}`}><button className="link" onClick={() => { set({ locations: [...draft.locations.filter(l => l.licenseId !== b.licenseId), { licenseId: b.licenseId, ...p }] }); setPlaces(x => ({ ...x, [b.licenseId]: [] })); }}>{p.label}</button></li>)}</ul>}

                </div>; })}

            </Block>
            {edit && <div className="save">

                {error && <p className="error" role="alert">{error}</p>}
                {saved && <p className="ok" role="status">{saved}</p>}
                <button className="primary" onClick={() => void save()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>

            </div>}

        </div>

    </main>;
}
