import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Check, Copy } from 'lucide-react';
import * as api from './api';
import { message } from './format';
import { Privacy } from './privacy';

type Step = { kind: 'server' } | { kind: 'login' } | { kind: 'enroll' } | { kind: 'totp'; email: string; password: string; secret: string; uri: string };

function useSubmit() {

    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const submit = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(message(e)); setBusy(false); } };

    return { busy, error, submit };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {

    return <label className="field">{label}{children}{hint && <small>{hint}</small>}</label>;
}

const codeInput = { inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}', maxLength: 6, required: true } as const;

export function Gate({ onSignedIn }: { onSignedIn: () => void }) {

    const [step, setStep] = useState<Step>(() => api.serverUrl() ? { kind: 'login' } : { kind: 'server' }), [reading, setReading] = useState(false);

    if (reading) return <Privacy close={() => setReading(false)} />;

    return <main className="gate">

        <img className="gate-mark" src="/symbol.png" alt="" width="56" height="56" />
        <div className="gate-sheet">

            {step.kind === 'server' && <Server next={() => setStep({ kind: 'login' })} />}
            {step.kind === 'login' && <Login onSignedIn={onSignedIn} enroll={() => setStep({ kind: 'enroll' })} />}
            {step.kind === 'enroll' && <Enroll next={(email, password, secret, uri) => setStep({ kind: 'totp', email, password, secret, uri })} back={() => setStep({ kind: 'login' })} />}
            {step.kind === 'totp' && <Authenticator {...step} done={() => setStep({ kind: 'login' })} />}

        </div>
        <button className="link quiet-link" onClick={() => setReading(true)}>Aviso de privacidad</button>

    </main>;
}

function Server({ next }: { next: () => void }) {

    const [url, setUrl] = useState('https://'), { busy, error, submit } = useSubmit();
    const send = (e: FormEvent) => { e.preventDefault(); void submit(async () => { try { api.chooseServer(url); } catch (problem) { if (problem instanceof api.ApiError) throw problem; throw new api.ApiError(400, 'bad_request', 'Esa dirección no es válida'); } next(); }); };

    return <>

        <h1>Conecta con Culinary</h1>
        <p>Escribe la dirección que te dio tu proveedor. Se pide una sola vez.</p>
        <form onSubmit={send}>

            <Field label="Dirección del servidor"><input type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} required autoFocus spellCheck={false} autoCapitalize="none" /></Field>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>Continuar</button>

        </form>

    </>;
}

function Login({ onSignedIn, enroll }: { onSignedIn: () => void; enroll: () => void }) {

    const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [totp, setTotp] = useState(''), { busy, error, submit } = useSubmit();
    const send = (e: FormEvent) => { e.preventDefault(); void submit(async () => { await api.login(email, password, totp); onSignedIn(); }); };

    return <>

        <h1>Culinary Dueño</h1>
        <p>Las ventas de tus sucursales, sin esperar al corte.</p>
        <form onSubmit={send}>

            <Field label="Correo"><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Field>
            <Field label="Contraseña"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></Field>
            <Field label="Código del autenticador"><input {...codeInput} value={totp} onChange={e => setTotp(e.target.value)} /></Field>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>

        </form>
        <button className="link" onClick={enroll}>Tengo un código de alta</button>
        <small className="gate-note">¿Perdiste tu contraseña o tu autenticador? Pide a tu proveedor un código nuevo.</small>

    </>;
}

function Enroll({ next, back }: { next: (email: string, password: string, secret: string, uri: string) => void; back: () => void }) {

    const [code, setCode] = useState(''), [password, setPassword] = useState(''), { busy, error, submit } = useSubmit();
    const send = (e: FormEvent) => { e.preventDefault(); void submit(async () => { const { email, totp } = await api.enroll(code, password); next(email, password, totp.secret, totp.uri); }); };

    return <>

        <h1>Crea tu cuenta</h1>
        <p>Tu proveedor te dio un código de alta. Sirve una sola vez y vence en 7 días.</p>
        <form onSubmit={send}>

            <Field label="Código de alta"><input value={code} onChange={e => setCode(e.target.value)} required autoFocus spellCheck={false} autoCapitalize="characters" /></Field>
            <Field label="Contraseña nueva" hint="Mínimo 12 caracteres."><input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} required /></Field>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>{busy ? 'Creando…' : 'Continuar'}</button>

        </form>
        <button className="link" onClick={back}>Ya tengo cuenta</button>

    </>;
}

function Authenticator({ email, password, secret, uri, done }: { email: string; password: string; secret: string; uri: string; done: () => void }) {

    const [qr, setQr] = useState(''), [totp, setTotp] = useState(''), [copied, setCopied] = useState(false), { busy, error, submit } = useSubmit();
    const send = (e: FormEvent) => { e.preventDefault(); void submit(async () => { await api.confirmEnroll(email, password, totp); done(); }); };
    const copy = async () => { await navigator.clipboard.writeText(secret); setCopied(true); };

    useEffect(() => { void QRCode.toDataURL(uri, { margin: 1, width: 196 }).then(setQr); }, [uri]);

    return <>

        <h1>Protege tu cuenta</h1>
        <p>Agrega esta clave a tu app de autenticación. Se muestra una sola vez.</p>
        <div className="totp">

            {qr && <img src={qr} alt="Código QR de la clave" width="196" height="196" />}
            <code>{secret}</code>
            <button className="ghost" type="button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Clave copiada' : 'Copiar clave'}</button>

        </div>
        <form onSubmit={send}>

            <Field label="Código de 6 dígitos"><input {...codeInput} value={totp} onChange={e => setTotp(e.target.value)} autoFocus /></Field>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>{busy ? 'Confirmando…' : 'Confirmar cuenta'}</button>

        </form>

    </>;
}
