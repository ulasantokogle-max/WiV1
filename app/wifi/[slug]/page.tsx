"use client";

import { useEffect, useState } from "react";
import type { PublicWifiCard } from "@/types/wiv1";

export default function WifiPage({ params }: { params: Promise<{ slug: string }> }) {
  const [card, setCard] = useState<PublicWifiCard | null>(null);
  const [source, setSource] = useState<"qr" | "nfc" | "direct">("direct");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConnectQr, setShowConnectQr] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [connectHelp, setConnectHelp] = useState("");
  const [device, setDevice] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setDevice(/iphone|ipad|ipod/.test(ua) ? "ios" : /android/.test(ua) ? "android" : "other");
    let cancelled = false;
    params.then(async ({ slug }) => {
      const querySource = new URLSearchParams(window.location.search).get("src");
      const eventSource = querySource === "qr" || querySource === "nfc" ? querySource : "direct";
      setSource(eventSource);
      try {
        const response = await fetch(`/api/wifi/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await response.json();
        if (!json.success) { if (!cancelled) setError(json.error ?? "WiFi tidak tersedia"); return; }
        if (cancelled) return;
        setCard(json.data);
        void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: json.data.id, eventType: eventSource === "qr" ? "qr_scan" : eventSource === "nfc" ? "nfc_scan" : "page_view", source: eventSource }) }).catch(() => {});
      } catch { if (!cancelled) setError("Koneksi bermasalah. Silakan coba lagi."); }
    });
    return () => { cancelled = true; };
  }, [params]);

  async function logEvent(eventType: "password_copy" | "wifi_connect") {
    if (!card) return;
    // Analytics must never block the user from connecting.
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, eventType, source }),
    }).catch(() => {});
  }

  async function copyNetworkPassword(): Promise<boolean> {
    if (!card || card.security_type.toLowerCase() === "open") return false;
    try {
      const response = await fetch(`/api/wifi/${encodeURIComponent(card.slug)}/secret`, { cache: "no-store" });
      if (!response.ok) throw new Error("Secret endpoint unavailable");
      const json = await response.json();
      if (!json.success || typeof json.data?.password !== "string") throw new Error("Invalid WiFi response");
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(json.data.password);
      setCopied(true);
      void logEvent("password_copy");
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }

  async function copyPassword() {
    const ok = await copyNetworkPassword();
    setConnectHelp(ok
      ? "Password disalin. Buka pengaturan WiFi, pilih jaringan di atas, lalu tempel password."
      : "Browser tidak mengizinkan penyalinan otomatis. Buka halaman melalui HTTPS dan izinkan Clipboard, lalu coba lagi.");
  }

  function connectWifi() {
    if (!card) return;
    const next = !showConnectQr;
    setShowConnectQr(next);
    setQrFailed(false);
    if (next) {
      setConnectHelp(card.security_type.toLowerCase() === "open"
        ? "Scan QR dengan kamera perangkat lain untuk bergabung ke jaringan Open. Jika memakai HP yang sama, buka Pengaturan WiFi dan pilih SSID di atas."
        : "Scan QR dengan kamera perangkat lain untuk bergabung. Jika memakai HP yang sama, gunakan Copy Password lalu pilih SSID melalui Pengaturan WiFi.");
      // Measures use of connection assistance, not actual WiFi association.
      void logEvent("wifi_connect");
    } else {
      setConnectHelp("");
    }
  }

  if (error) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-icon">×</div><h1>WiFi tidak tersedia</h1><p className="muted">{error}</p></div></main>;
  if (!card) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-loader">Wi</div><h1>Menyiapkan WiFi…</h1><p className="muted">Mohon tunggu sebentar.</p></div></main>;

  return <main className="wifi-page"><div className="wifi-card">
    {card.logo_url ? <img className="wifi-logo" src={card.logo_url} alt="" /> : <div className="wifi-icon">Wi</div>}
    <p className="wifi-eyebrow">WIFI ACCESS</p><h1>{card.business_name}</h1><p className="muted">Terhubung ke internet dengan mudah.</p>
    <div className="network-box"><span>Nama WiFi</span><strong>{card.ssid}</strong><small>{card.security_type}</small></div>
    <div className="wifi-actions">
      {card.security_type.toLowerCase() !== "open" &&
        <button className="copy-button" onClick={copyPassword}>
          {copied ? "✓ Password Tersalin" : "Copy Password"}
        </button>}
      <button className="connect-button" onClick={connectWifi} aria-expanded={showConnectQr} aria-controls="wifi-connect-details">
        {showConnectQr ? "Tutup QR WiFi" : "Bantu Hubungkan WiFi"}
      </button>
    </div>
    {showConnectQr && <div id="wifi-connect-details" className="wifi-connect-panel">
      <strong>Scan untuk terhubung ke WiFi</strong>
      <p className="muted">QR ini berisi konfigurasi jaringan, bukan link halaman. Scan menggunakan kamera perangkat lain.</p>
      {!qrFailed ? <img className="wifi-connect-qr" src={`/api/wifi/${encodeURIComponent(card.slug)}/connect-qr`} alt={`QR koneksi WiFi ${card.ssid}`} onError={() => setQrFailed(true)} /> :
        <p role="alert">QR tidak tersedia. Gunakan cara manual melalui pengaturan WiFi perangkat.</p>}
      <p className="muted">Menggunakan HP yang sama? Buka Pengaturan WiFi, pilih <strong>{card.ssid}</strong>{card.security_type.toLowerCase() === "open" ? " (tanpa password)." : ", kemudian tempel password yang disalin."}</p>
      {card.security_type.toLowerCase() !== "open" && <p className="muted">QR untuk jaringan berpassword mengandung kredensial WiFi. Jangan bagikan atau simpan gambarnya sembarangan.</p>}
    </div>}
    {connectHelp && <div role="status" className="device-tip"><p>{connectHelp}</p></div>}
    {card.instructions && <div className="instructions"><strong>Cara terhubung</strong><p>{card.instructions}</p></div>}<div className="device-tip"><strong>{device === "ios" ? "iPhone / iPad" : device === "android" ? "Android" : "HP / Laptop"}</strong><p>{device === "ios" ? "Tampilkan QR WiFi untuk perangkat lain, atau pilih jaringan ini di Settings → Wi-Fi." : device === "android" ? "Tampilkan QR WiFi untuk perangkat lain, atau pilih jaringan ini di pengaturan Wi-Fi." : "Tampilkan QR WiFi untuk perangkat lain, atau pilih jaringan ini di pengaturan Wi-Fi."}</p></div>
    <p className="wifi-footer">WiV1 · WiFi access made simple</p>
  </div></main>;
}
