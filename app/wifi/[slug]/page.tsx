"use client";

import { useEffect, useState } from "react";
import type { PublicWifiCard } from "@/types/wiv1";

export default function WifiPage({ params }: { params: Promise<{ slug: string }> }) {
  const [card, setCard] = useState<PublicWifiCard | null>(null);
  const [source, setSource] = useState<"qr" | "nfc" | "direct">("direct");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
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
        await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: json.data.id, eventType: eventSource === "qr" ? "qr_scan" : eventSource === "nfc" ? "nfc_scan" : "page_view", source: eventSource }) });
      } catch { if (!cancelled) setError("Koneksi bermasalah. Silakan coba lagi."); }
    });
    return () => { cancelled = true; };
  }, [params]);

  async function copyPassword() {
    if (!card) return;
    const response = await fetch(`/api/wifi/${encodeURIComponent(card.slug)}/secret`, { cache: "no-store" });
    const json = await response.json();
    if (!json.success) return;
    await navigator.clipboard.writeText(json.data.password);
    setCopied(true);
    await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, eventType: "password_copy", source }) });
    setTimeout(() => setCopied(false), 1800);
  }

  function wifiEscape(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/:/g, "\\:");
  }

  async function connectWifi() {
    if (!card || connecting) return;
    setConnecting(true);
    try {
      const response = await fetch(`/api/wifi/${encodeURIComponent(card.slug)}/secret`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Password WiFi tidak tersedia");
      const password = json.data.password || "";
      const type = card.security_type.toLowerCase() === "open" ? "nopass" : "WPA";
      const wifiUri = `WIFI:T:${type};S:${wifiEscape(card.ssid)};P:${wifiEscape(password)};;`;
      await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, eventType: "wifi_connect", source }) });
      window.location.href = wifiUri;
    } catch {
      setConnecting(false);
      setError("Koneksi WiFi otomatis tidak tersedia di browser ini. Gunakan tombol Copy Password lalu sambungkan dari pengaturan WiFi.");
    }
  }

  if (error) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-icon">×</div><h1>WiFi tidak tersedia</h1><p className="muted">{error}</p></div></main>;
  if (!card) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-loader">Wi</div><h1>Menyiapkan WiFi…</h1><p className="muted">Mohon tunggu sebentar.</p></div></main>;

  return <main className="wifi-page"><div className="wifi-card">
    {card.logo_url ? <img className="wifi-logo" src={card.logo_url} alt="" /> : <div className="wifi-icon">Wi</div>}
    <p className="wifi-eyebrow">WIFI ACCESS</p><h1>{card.business_name}</h1><p className="muted">Terhubung ke internet dengan mudah.</p>
    <div className="network-box"><span>Nama WiFi</span><strong>{card.ssid}</strong><small>{card.security_type}</small></div>
    <div className="wifi-actions"><button className="copy-button" onClick={copyPassword}>{copied ? "✓ Password Tersalin" : "Copy Password"}</button><button className="connect-button" onClick={connectWifi} disabled={connecting}>{connecting ? "Membuka koneksi…" : "Connect WiFi"}</button></div>
    {card.instructions && <div className="instructions"><strong>Cara terhubung</strong><p>{card.instructions}</p></div>}<div className="device-tip"><strong>{device === "ios" ? "iPhone / iPad" : device === "android" ? "Android" : "HP / Laptop"}</strong><p>{device === "ios" ? "Tap Connect WiFi. Jika perangkat tidak membuka koneksi otomatis, copy password lalu pilih jaringan ini di Settings → Wi‑Fi." : device === "android" ? "Tap Connect WiFi. Jika perangkat tidak membuka koneksi otomatis, copy password lalu pilih jaringan ini di Wi‑Fi." : "Tap Connect WiFi bila perangkat mendukung WiFi URI. Jika tidak, copy password dan sambungkan dari menu WiFi."}</p></div>
    <p className="wifi-footer">WiV1 · WiFi access made simple</p>
  </div></main>;
}
