import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import * as api from './api';
import { sealCsd } from './csd';
import { message } from './format';
import { Block } from './parts';

// Invoicing, only for the account's owner: the business as the provider registered it, the sellos each branch holds and
// the form that sends new ones. The files are encrypted here for the branch; nobody can download them afterwards, not even
// the owner, so changing them means sending the new ones.

const REGIMES: Record<string, string> = {
    '601': 'General de Ley Personas Morales', '603': 'Personas Morales con Fines no Lucrativos', '606': 'Arrendamiento', '607': 'Enajenación o Adquisición de Bienes',
    '608': 'Demás ingresos', '610': 'Residentes en el Extranjero', '612': 'Actividades Empresariales y Profesionales', '620': 'Sociedades Cooperativas de Producción',
    '621': 'Incorporación Fiscal', '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', '623': 'Opcional para Grupos de Sociedades', '624': 'Coordinados',
    '625': 'Plataformas Tecnológicas', '626': 'Régimen Simplificado de Confianza'
};
const MAX_BYTES = 8192;
const day = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const refuse = (text: string) => new api.ApiError(0, 'input', text);

export function FiscalView({ data, refresh }: { data: { fiscal: api.FiscalBranch[] }; refresh: () => void }) {

    return <main className="report fiscal">

        <p className="note first">Los sellos digitales (CSD) se cifran en este equipo para la sucursal, que revisa que sean del RFC del negocio y estén vigentes y los carga en Facturama. No se guardan en ningún otro lado ni se pueden descargar después.</p>
        {data.fiscal.map(b => <BranchSeals key={b.licenseId} branch={b} done={refresh} />)}
        {!data.fiscal.length && <p className="quiet">No hay sucursales en tu cuenta.</p>}

    </main>;
}

function BranchSeals({ branch, done }: { branch: api.FiscalBranch; done: () => void }) {

    const [cer, setCer] = useState<File | null>(null), [key, setKey] = useState<File | null>(null), [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(''), [form, setForm] = useState(0);
    const { business, csd, last, intake } = branch;
    const days = csd.loaded ? Math.ceil((Date.parse(csd.notAfter) - Date.now()) / 86_400_000) : null;
    const send = async () => {

        setBusy(true); setError(''); setSent('');

        try {

            if (!cer || !key || !password) throw refuse('Elige el .cer, el .key y escribe la contraseña de la llave privada.');
            if (!cer.name.toLowerCase().endsWith('.cer') || !key.name.toLowerCase().endsWith('.key')) throw refuse('El certificado termina en .cer y la llave privada en .key.');
            if (cer.size > MAX_BYTES || key.size > MAX_BYTES) throw refuse('Los archivos del CSD pesan unos 2 KB; revisa que sean esos y no la e.firma completa.');
            if (!intake) throw refuse('La sucursal aún no se conecta para recibir sellos. Enciéndela y espera unos minutos.');

            const id = crypto.randomUUID();
            const files = { cer: new Uint8Array(await cer.arrayBuffer()), key: new Uint8Array(await key.arrayBuffer()), password };
            const envelope = await sealCsd(intake, branch.licenseId, id, files).catch(() => { throw refuse('No se pudo cifrar para la sucursal; vuelve a abrir esta pantalla.'); });

            files.key.fill(0);
            await api.sendCsd(branch.licenseId, { id, intakeSha256: intake.sha256, envelope });
            setPassword(''); setCer(null); setKey(null); setForm(f => f + 1);
            setSent('Enviado cifrado. La sucursal lo revisa y lo carga en Facturama en un par de minutos.');
            done();

        } catch (e) { setError(message(e)); } finally { setBusy(false); }

    };

    return <Block title={branch.branchName} meta={csd.loaded ? 'Sellos cargados' : 'Sin sellos'}>

        {business
            ? <p className="note first"><b>{business.rfc}</b> · {business.name}<br />Régimen {business.regime} {REGIMES[business.regime] ?? ''} · C.P. fiscal {business.postalCode}</p>
            : <p className="error">Tu proveedor aún no registra los datos fiscales de esta sucursal (RFC, razón social, régimen y código postal). Pídele que los capture para poder facturar.</p>}
        {csd.loaded && <p className={days! <= 30 ? 'error' : 'ok'} role="status"><ShieldCheck size={16} aria-hidden="true" /> Sellos cargados con éxito · certificado {csd.serial} · vencen el {day(csd.notAfter)}{days! <= 30 ? `, en ${days} días: tramita los nuevos en CertiSAT` : ''}.</p>}
        {last && last.status !== 'loaded' && <p className={last.status === 'pending' ? 'note' : 'error'}>{last.status === 'pending' ? 'Envío en camino: la sucursal aún no lo abre.' : `Último envío ${last.status === 'rejected' ? 'rechazado' : 'sin recibir'}: ${last.message ?? ''}`}</p>}
        {business && <div className="csd-form" key={form}>

            <label className="field">Certificado (.cer)<input type="file" accept=".cer" onChange={e => setCer(e.target.files?.[0] ?? null)} /></label>
            <label className="field">Llave privada (.key)<input type="file" accept=".key" onChange={e => setKey(e.target.files?.[0] ?? null)} /></label>
            <label className="field">Contraseña de la llave privada<input type="password" autoComplete="off" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
            {error && <p className="error" role="alert">{error}</p>}
            {sent && <p className="ok" role="status">{sent}</p>}
            <button className="primary" onClick={() => void send()} disabled={busy}><KeyRound size={18} aria-hidden="true" />{busy ? 'Cifrando…' : csd.loaded ? 'Reemplazar sellos' : 'Enviar sellos'}</button>

        </div>}

    </Block>;
}
