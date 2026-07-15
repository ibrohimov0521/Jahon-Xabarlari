"use client";

import { Check, Clipboard, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Button, ErrorBanner, Input, LoadingBlock, Panel, SuccessBanner } from "./ui";

type Status = { enabled: boolean; setupPending: boolean; recoveryCodesRemaining: number };

export function SecurityView({ onReauthenticate }: { onReauthenticate: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setStatus(await adminRequest<Status>("/auth/2fa/status"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xavfsizlik holati yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function beginSetup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ secret: string; uri: string }>("/auth/2fa/setup", { method: "POST", body: JSON.stringify({ password }) });
      setSecret(data.secret); setUri(data.uri); setPassword(""); setStatus((current) => current ? { ...current, setupPending: true } : current);
    } catch (err) { setError(err instanceof Error ? err.message : "2FA sozlanmadi"); }
    finally { setBusy(false); }
  }

  async function enable() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
      setRecoveryCodes(data.recoveryCodes); setCode(""); setSecret(""); setUri("");
      setStatus({ enabled: true, setupPending: false, recoveryCodesRemaining: data.recoveryCodes.length });
      setMessage("Ikki bosqichli himoya yoqildi. Tiklash kodlarini xavfsiz joyda saqlang.");
    } catch (err) { setError(err instanceof Error ? err.message : "Kod tasdiqlanmadi"); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ reauthenticate: boolean }>("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
      if (data.reauthenticate) onReauthenticate();
    } catch (err) { setError(err instanceof Error ? err.message : "2FA o'chirilmadi"); }
    finally { setBusy(false); }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Panel title="Hisob xavfsizligi">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      {loading && <LoadingBlock />}
      {!loading && status && (
        <div className="grid gap-5">
          <div className={`flex items-start gap-4 rounded-lg border p-4 ${status.enabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${status.enabled ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-700"}`}>
              {status.enabled ? <ShieldCheck size={23} /> : <ShieldOff size={23} />}
            </span>
            <div>
              <h4 className="font-black">Ikki bosqichli himoya {status.enabled ? "yoqilgan" : "o'chirilgan"}</h4>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {status.enabled ? `${status.recoveryCodesRemaining} ta tiklash kodi qolgan.` : "Admin paroli o'g'irlangan taqdirda ham Authenticator kodi hisobni himoya qiladi."}
              </p>
            </div>
          </div>

          {!status.enabled && !secret && (
            <div className="grid gap-3 sm:max-w-md">
              <Input label="Joriy parol bilan tasdiqlang" type="password" value={password} onChange={setPassword} />
              <Button onClick={beginSetup} disabled={busy || password.length < 8} icon={<KeyRound size={17} />}>2FA sozlashni boshlash</Button>
            </div>
          )}

          {!status.enabled && secret && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <h4 className="font-black">1. Authenticator ilovasiga kalitni kiriting</h4>
                <p className="mt-1 text-sm text-slate-600">Google Authenticator, Microsoft Authenticator yoki 1Password ishlaydi.</p>
                <code className="mt-3 block break-all rounded-md bg-white p-3 text-sm font-black text-brand">{secret}</code>
                <details className="mt-2 text-xs text-slate-500"><summary>Texnik URI</summary><code className="mt-2 block break-all">{uri}</code></details>
              </div>
              <Input label="2. Ilovadagi 6 xonali kod" value={code} onChange={setCode} placeholder="123456" />
              <Button onClick={enable} disabled={busy || !/^\d{6}$/.test(code)} icon={<ShieldCheck size={17} />}>Himoyani yoqish</Button>
            </div>
          )}

          {!!recoveryCodes.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><h4 className="font-black">Tiklash kodlari</h4><p className="text-sm text-slate-600">Har biri faqat bir marta ishlaydi va qayta ko'rsatilmaydi.</p></div>
                <Button variant="secondary" size="sm" onClick={copyCodes} icon={copied ? <Check size={15} /> : <Clipboard size={15} />}>{copied ? "Nusxalandi" : "Nusxalash"}</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">{recoveryCodes.map((item) => <code className="rounded bg-white p-2" key={item}>{item}</code>)}</div>
            </div>
          )}

          {status.enabled && (
            <div className="grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <h4 className="font-black text-red-700">2FA himoyasini o'chirish</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Joriy parol" type="password" value={password} onChange={setPassword} />
                <Input label="Authenticator yoki tiklash kodi" value={code} onChange={setCode} />
              </div>
              <Button variant="danger" onClick={disable} disabled={busy || !password || !code} icon={<ShieldOff size={17} />}>Himoyani o'chirish</Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
