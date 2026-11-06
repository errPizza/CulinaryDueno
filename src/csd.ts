// The CSD leaves this device sealed to the branch's intake key: ECDH P-256, HKDF-SHA-256 and AES-256-GCM, with the
// license, the sending and the key as associated data. CulinaryServer carries it without being able to open it; the branch
// (MesaNexo.Api/FiscalIntake.cs) opens it, checks it, loads it into Facturama and keeps nothing but the result.

export type Intake = { spki: string; sha256: string };
export type CsdFiles = { cer: Uint8Array; key: Uint8Array; password: string };
export type Envelope = { v: 1; epk: string; salt: string; iv: string; ct: string };

const LABEL = 'culinary-csd-v1';

function base64(bytes: Uint8Array): string {

    let text = '';

    for (const byte of bytes) text += String.fromCharCode(byte);

    return btoa(text);
}

const base64Url = (bytes: Uint8Array) => base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {

    const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));

    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function sealCsd(intake: Intake, licenseId: string, submissionId: string, files: CsdFiles): Promise<Envelope> {

    const spki = fromBase64Url(intake.spki);

    // The key must be the one the hash names: the branch refuses an envelope sealed to any other.
    if (hex(await crypto.subtle.digest('SHA-256', spki)) !== intake.sha256) throw new Error('La llave de la sucursal no coincide; vuelve a abrir esta pantalla.');

    const context = new TextEncoder().encode(`${LABEL}|${licenseId}|${submissionId}|${intake.sha256}`);
    const branch = await crypto.subtle.importKey('spki', spki, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: branch }, ephemeral.privateKey, 256);
    const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: context }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const plain = new TextEncoder().encode(JSON.stringify({ cer: base64(files.cer), key: base64(files.key), password: files.password }));
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context, tagLength: 128 }, key, plain));

    plain.fill(0);

    return { v: 1, epk: base64Url(new Uint8Array(await crypto.subtle.exportKey('spki', ephemeral.publicKey))), salt: base64Url(salt), iv: base64Url(iv), ct: base64Url(sealed) };
}
