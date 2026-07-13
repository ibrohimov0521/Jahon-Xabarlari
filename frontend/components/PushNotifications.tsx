"use client";

import { BellRing, Check, Loader2, Settings2, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/config";
import { timeoutSignal } from "../lib/http";
import { useUi, type Language } from "../lib/ui-context";

type PushState = "loading" | "default" | "enabled" | "denied" | "unsupported";

const COPY = {
  uz: {
    title: "Muhim xabarlarni o'tkazib yubormang",
    body: "Breaking va muharrir tanlagan eng muhim yangiliklar qurilmangizga keladi.",
    enable: "Bildirishnomalarni yoqish",
    later: "Keyinroq",
    settings: "Bildirishnomalar",
    enabled: "Bildirishnomalar yoqilgan",
    enabledBody: "Breaking va Featured yangiliklar shu qurilmaga yuboriladi.",
    disable: "O'chirish",
    denied: "Brauzer bildirishnomalarni bloklagan. Sayt sozlamalaridan ruxsatni qayta yoqing.",
    ios: "iPhone'da saytni Share → Add to Home Screen orqali o'rnating, keyin shu tugmani bosing.",
    unsupported: "Bu brauzer Web Push bildirishnomalarini qo'llamaydi.",
    error: "Bildirishnomalarni yoqib bo'lmadi. Qayta urinib ko'ring."
  },
  ru: {
    title: "Не пропускайте важные новости",
    body: "Срочные и выбранные редакцией новости будут приходить на ваше устройство.",
    enable: "Включить уведомления",
    later: "Позже",
    settings: "Уведомления",
    enabled: "Уведомления включены",
    enabledBody: "Срочные и избранные новости будут отправляться на это устройство.",
    disable: "Отключить",
    denied: "Браузер заблокировал уведомления. Разрешите их в настройках сайта.",
    ios: "На iPhone добавьте сайт через Share → Add to Home Screen, затем нажмите эту кнопку.",
    unsupported: "Этот браузер не поддерживает Web Push.",
    error: "Не удалось включить уведомления. Попробуйте ещё раз."
  },
  en: {
    title: "Don't miss important news",
    body: "Breaking and editor-selected stories will arrive on your device.",
    enable: "Enable notifications",
    later: "Later",
    settings: "Notifications",
    enabled: "Notifications enabled",
    enabledBody: "Breaking and featured stories will be sent to this device.",
    disable: "Disable",
    denied: "Notifications are blocked. Re-enable them in this site's browser settings.",
    ios: "On iPhone, install the site using Share → Add to Home Screen, then tap this button.",
    unsupported: "This browser does not support Web Push.",
    error: "Notifications could not be enabled. Please try again."
  }
} as const;

const SNOOZE_KEY = "jx_push_prompt_snoozed_until";
const SETTINGS_EVENT = "jx:push-settings";

export function openPushSettings() {
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function toUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PushNotifications() {
  const { language } = useUi();
  const copy = COPY[language];
  const [state, setState] = useState<PushState>("loading");
  const [promptOpen, setPromptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [justEnabled, setJustEnabled] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSubscription = useCallback(async (subscription: PushSubscription, lang: Language) => {
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Subscription kalitlari topilmadi");
    const response = await fetch(`${API_URL}/push/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        language: lang,
        importantOnly: true,
        categorySlugs: []
      }),
      signal: timeoutSignal(15_000)
    });
    if (!response.ok) throw new Error("Subscription saqlanmadi");
  }, []);

  useEffect(() => {
    const openSettings = () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      if (promptHideTimer.current) clearTimeout(promptHideTimer.current);
      setJustEnabled(false);
      setPromptOpen(false);
      setSettingsOpen(true);
      setMessage("");
    };
    window.addEventListener(SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current);
    if (promptHideTimer.current) clearTimeout(promptHideTimer.current);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function initialize() {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setState("unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (existing && Notification.permission === "granted") {
          setState("enabled");
          syncSubscription(existing, language).catch(() => {});
          return;
        }
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        setState("default");
        const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        if (snoozedUntil <= Date.now()) timer = setTimeout(() => {
          setPromptOpen(true);
          promptHideTimer.current = setTimeout(() => {
            setPromptOpen(false);
            localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
          }, 6_500);
        }, 10_000);
      } catch {
        if (!cancelled) setState("unsupported");
      }
    }

    initialize();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [language, syncSubscription]);

  const enable = async () => {
    setBusy(true);
    setMessage("");
    setPromptOpen(false);
    if (promptHideTimer.current) clearTimeout(promptHideTimer.current);
    try {
      if (isIos() && !isStandalone()) {
        setMessage(copy.ios);
        setSettingsOpen(true);
        setPromptOpen(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        setMessage(permission === "denied" ? copy.denied : "");
        setSettingsOpen(permission === "denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch(`${API_URL}/push/public-key`, { signal: timeoutSignal(15_000) });
      if (!keyResponse.ok) throw new Error("VAPID kaliti olinmadi");
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(publicKey) }));
      await syncSubscription(subscription, language);
      setState("enabled");
      setJustEnabled(true);
      setSettingsOpen(true);
      localStorage.removeItem(SNOOZE_KEY);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => {
        setSettingsOpen(false);
        setJustEnabled(false);
      }, 900);
    } catch {
      setJustEnabled(false);
      setMessage(copy.error);
      setSettingsOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`${API_URL}/push/subscriptions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          signal: timeoutSignal(15_000)
        });
        await subscription.unsubscribe();
      }
      setState("default");
      setJustEnabled(false);
      setSettingsOpen(false);
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      setMessage(copy.error);
    } finally {
      setBusy(false);
    }
  };

  const snooze = () => {
    if (promptHideTimer.current) clearTimeout(promptHideTimer.current);
    setPromptOpen(false);
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  return (
    <>
      {promptOpen && state === "default" && (
        <aside className="push-prompt" aria-label={copy.settings}>
          <button className="push-prompt-close" onClick={snooze} aria-label="Yopish"><X size={16} /></button>
          <span className="push-prompt-icon"><BellRing size={22} /></span>
          <div className="push-prompt-copy">
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
          <div className="push-prompt-actions">
            <button className="push-primary" onClick={enable} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={17} /> : <BellRing size={17} />} {copy.enable}</button>
            <button className="push-secondary" onClick={snooze}>{copy.later}</button>
          </div>
        </aside>
      )}

      {settingsOpen && (
        <div className="push-settings-layer" role="presentation">
          <button className="push-settings-backdrop" onClick={() => setSettingsOpen(false)} aria-label="Yopish" />
          <section className={`push-settings-card ${justEnabled ? "is-success" : ""}`} role="dialog" aria-modal="true" aria-label={copy.settings}>
            {!justEnabled && <button className="push-settings-close" onClick={() => setSettingsOpen(false)} aria-label="Yopish"><X size={18} /></button>}
            <span className={`push-settings-icon ${state === "enabled" ? "is-enabled" : ""}`}>
              {state === "enabled" ? <Check size={25} /> : isIos() && !isStandalone() ? <Smartphone size={25} /> : <Settings2 size={25} />}
            </span>
            <h2>{state === "enabled" ? copy.enabled : copy.settings}</h2>
            <p>{message || (state === "enabled" ? copy.enabledBody : state === "denied" ? copy.denied : state === "unsupported" ? (isIos() ? copy.ios : copy.unsupported) : copy.body)}</p>
            {state === "enabled" ? (!justEnabled ? (
              <button className="push-secondary is-danger" onClick={disable} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={17} /> : null}{copy.disable}</button>
            ) : null) : state !== "denied" && state !== "unsupported" ? (
              <button className="push-primary" onClick={enable} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={17} /> : <BellRing size={17} />}{copy.enable}</button>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
