"use client";

import { Check, Clipboard, KeyRound, LockKeyhole, QrCode, ShieldCheck, ShieldOff } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Button, ErrorBanner, Input, LoadingBlock, Panel, SuccessBanner } from "./ui";

type Status = { enabled: boolean; setupPending: boolean; recoveryCodesRemaining: number };

export function SecurityView({ onReauthenticate }: { onReauthenticate: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", code: "" });
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"setup" | "enable" | "disable" | "password" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

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

  useEffect(() => {
    let active = true;
    if (!uri) {
      setQrImage("");
      return () => { active = false; };
    }
    void QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#07132f", light: "#ffffff" }
    }).then((image) => {
      if (active) setQrImage(image);
    }).catch(() => {
      if (active) setError("QR kod yaratilmadi. Maxfiy kalitni qo'lda kiriting.");
    });
    return () => { active = false; };
  }, [uri]);

  async function beginSetup() {
    setBusyAction("setup"); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ secret: string; uri: string; resumed: boolean }>("/auth/2fa/setup", {
        method: "POST",
        body: JSON.stringify({ password: setupPassword })
      });
      setSecret(data.secret);
      setUri(data.uri);
      setSetupPassword("");
      setStatus((current) => current ? { ...current, setupPending: true } : current);
      if (data.resumed) setMessage("Avval boshlangan 2FA sozlamasi tiklandi. QR kod o'zgarmadi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA sozlanmadi");
    } finally {
      setBusyAction("");
    }
  }

  async function enable() {
    setBusyAction("enable"); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ recoveryCodes: string[] }>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: setupCode })
      });
      setRecoveryCodes(data.recoveryCodes);
      setSetupCode(""); setSecret(""); setUri("");
      setStatus({ enabled: true, setupPending: false, recoveryCodesRemaining: data.recoveryCodes.length });
      setMessage("Ikki bosqichli himoya yoqildi. Tiklash kodlarini xavfsiz joyda saqlang.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod tasdiqlanmadi");
    } finally {
      setBusyAction("");
    }
  }

  async function disable() {
    setBusyAction("disable"); setError(""); setMessage("");
    try {
      const data = await adminRequest<{ reauthenticate: boolean }>("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword, code: disableCode })
      });
      if (data.reauthenticate) onReauthenticate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA o'chirilmadi");
    } finally {
      setBusyAction("");
    }
  }

  async function changePassword() {
    setError(""); setMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Yangi parol va uning tasdig'i bir xil emas");
      return;
    }
    setBusyAction("password");
    try {
      const data = await adminRequest<{ reauthenticate: boolean }>("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          ...(status?.enabled ? { code: passwordForm.code } : {})
        })
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "", code: "" });
      if (data.reauthenticate) onReauthenticate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parol o'zgartirilmadi");
    } finally {
      setBusyAction("");
    }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setSecretCopied(true); window.setTimeout(() => setSecretCopied(false), 1500);
  }

  const passwordIsStrong = passwordForm.newPassword.length >= 12
    && /[a-z]/.test(passwordForm.newPassword)
    && /[A-Z]/.test(passwordForm.newPassword)
    && /\d/.test(passwordForm.newPassword);
  const canChangePassword = passwordForm.currentPassword.length >= 8
    && passwordIsStrong
    && passwordForm.newPassword === passwordForm.confirmPassword
    && (!status?.enabled || Boolean(passwordForm.code));

  return (
    <Panel title="Hisob xavfsizligi">
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      {loading && <LoadingBlock />}
      {!loading && status && (
        <div className="grid gap-6">
          <div className={`admin-security-status ${status.enabled ? "is-enabled" : "is-disabled"}`}>
            <span className="admin-security-status-icon">
              {status.enabled ? <ShieldCheck size={23} /> : <ShieldOff size={23} />}
            </span>
            <div>
              <h4>Ikki bosqichli himoya {status.enabled ? "yoqilgan" : "o'chirilgan"}</h4>
              <p>
                {status.enabled
                  ? `${status.recoveryCodesRemaining} ta tiklash kodi qolgan.`
                  : status.setupPending
                    ? "Sozlash boshlangan. Joriy parolni kiriting va o'sha QR kod bilan davom eting."
                    : "Paroldan tashqari Authenticator kodi ham talab qilinadi."}
              </p>
            </div>
          </div>

          {!status.enabled && !secret && (
            <section className="admin-security-section sm:max-w-xl">
              <div>
                <h4>Authenticator bilan himoyalash</h4>
                <p>Joriy parolni tasdiqlagach, skanerlash uchun doimiy QR kod beriladi.</p>
              </div>
              <Input label="Joriy parol" type="password" value={setupPassword} onChange={setSetupPassword} />
              <Button
                onClick={beginSetup}
                disabled={Boolean(busyAction) || setupPassword.length < 8}
                icon={<KeyRound size={17} />}
              >
                {busyAction === "setup" ? "Tayyorlanmoqda..." : status.setupPending ? "Sozlashni davom ettirish" : "2FA sozlashni boshlash"}
              </Button>
            </section>
          )}

          {!status.enabled && secret && (
            <section className="admin-security-section">
              <div className="grid items-center gap-5 md:grid-cols-[auto_1fr]">
                <div className="admin-qr-frame">
                  {qrImage ? <img src={qrImage} alt="Authenticator uchun QR kod" width={224} height={224} /> : <QrCode size={72} />}
                </div>
                <div>
                  <span className="admin-security-step">1-qadam</span>
                  <h4 className="mt-2">QR kodni Authenticator ilovasida skanerlang</h4>
                  <p className="mt-1">Google Authenticator, Microsoft Authenticator yoki 1Password bilan ishlaydi. Shu QR kod tasdiqlangunga qadar o'zgarmaydi.</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-black text-brand">Qo'lda kiritish kaliti</summary>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="admin-secret-code">{secret}</code>
                      <Button variant="secondary" size="sm" onClick={copySecret} icon={secretCopied ? <Check size={15} /> : <Clipboard size={15} />}>
                        {secretCopied ? "Nusxalandi" : "Nusxalash"}
                      </Button>
                    </div>
                  </details>
                </div>
              </div>
              <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[minmax(220px,360px)_auto] sm:items-end">
                <Input label="2-qadam: ilovadagi 6 xonali kod" value={setupCode} onChange={(value) => setSetupCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
                <Button onClick={enable} disabled={Boolean(busyAction) || !/^\d{6}$/.test(setupCode)} icon={<ShieldCheck size={17} />}>
                  {busyAction === "enable" ? "Tekshirilmoqda..." : "Himoyani yoqish"}
                </Button>
              </div>
            </section>
          )}

          {!!recoveryCodes.length && (
            <section className="admin-security-recovery">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h4>Tiklash kodlari</h4><p>Har biri faqat bir marta ishlaydi va qayta ko'rsatilmaydi.</p></div>
                <Button variant="secondary" size="sm" onClick={copyCodes} icon={copied ? <Check size={15} /> : <Clipboard size={15} />}>
                  {copied ? "Nusxalandi" : "Nusxalash"}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div>
            </section>
          )}

          {status.enabled && (
            <section className="admin-security-danger">
              <div><h4>2FA himoyasini o'chirish</h4><p>Bu amal barcha faol sessiyalarni yakunlaydi.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Joriy parol" type="password" value={disablePassword} onChange={setDisablePassword} />
                <Input label="Authenticator yoki tiklash kodi" value={disableCode} onChange={setDisableCode} />
              </div>
              <Button variant="danger" onClick={disable} disabled={Boolean(busyAction) || !disablePassword || !disableCode} icon={<ShieldOff size={17} />}>
                {busyAction === "disable" ? "O'chirilmoqda..." : "Himoyani o'chirish"}
              </Button>
            </section>
          )}

          <section className="admin-security-section">
            <div className="flex items-start gap-3">
              <span className="admin-password-icon"><LockKeyhole size={20} /></span>
              <div><h4>Login parolini o'zgartirish</h4><p>Kamida 12 belgi, katta-kichik harf va raqam ishlating. O'zgargach barcha sessiyalardan chiqiladi.</p></div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <Input label="Joriy parol" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
              <Input label="Yangi parol" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} />
              <Input label="Yangi parolni takrorlang" type="password" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))} />
            </div>
            {status.enabled && (
              <div className="sm:max-w-md">
                <Input label="Authenticator yoki tiklash kodi" value={passwordForm.code} onChange={(value) => setPasswordForm((current) => ({ ...current, code: value }))} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={changePassword} disabled={Boolean(busyAction) || !canChangePassword} icon={<KeyRound size={17} />}>
                {busyAction === "password" ? "O'zgartirilmoqda..." : "Parolni o'zgartirish"}
              </Button>
              {passwordForm.newPassword && !passwordIsStrong && <span className="text-xs font-bold text-amber-600">Parol talablarga hali mos emas.</span>}
            </div>
          </section>
        </div>
      )}
    </Panel>
  );
}
