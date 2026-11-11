"use client";

import { useEffect, useState } from "react";
import type { PublicWifiCard } from "@/types/wiv1";

export default function WifiPage({ params }: { params: Promise<{ slug: string }> }) {
  const [card, setCard] = useState<PublicWifiCard | null>(null);
  const [source, setSource] = useState<"qr" | "nfc" | "direct">("direct");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
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

  async function connectWifi() {
    if (!card || connecting) return;
    setConnecting(true);
    try {
      if (card.security_type.toLowerCase() === "open") {
        setConnectHelp("Jaringan ini tidak memerlukan password. Buka pengaturan WiFi perangkat dan pilih nama jaringan di atas.");
      } else {
        const copiedNow = await copyNetworkPassword();
        setConnectHelp(copiedNow
          ? "Password berhasil disalin. Buka pengaturan WiFi perangkat, pilih jaringan di atas, dan tempel password."
          : "Penyalinan password tidak didukung atau gagal. Buka melalui HTTPS, gunakan tombol Copy Password, lalu sambungkan dari pengaturan WiFi.");
      }
      // This is a connection-help interaction; it does not verify WiFi association.
      void logEvent("wifi_connect");
    } finally {
      setConnecting(false);
    }
  }

  if (error) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-icon">×</div><h1>WiFi tidak tersedia</h1><p className="muted">{error}</p></div></main>;
  if (!card) return <main className="wifi-page"><div className="wifi-card"><div className="wifi-loader">Wi</div><h1>Menyiapkan WiFi…</h1><p className="muted">Mohon tunggu sebentar.</p></div></main>;

  return <main className="wifi-page"><div className="wifi-card">
    {card.logo_url ? <img className="wifi-logo" src={card.logo_url} alt="" /> : <div className="wifi-icon">Wi</div>}
    <p className="wifi-eyebrow">WIFI ACCESS</p><h1>{card.business_name}</h1><p className="muted">Terhubung ke internet dengan mudah.</p>
    <div className="network-box"><span>Nama WiFi</span><strong>{card.ssid}</strong><small>{card.security_type}</small></div>
    <div className="wifi-actions"><button className="copy-button" onClick={copyPassword} disabled={card.security_type.toLowerCase() === "open"}>{card.security_type.toLowerCase() === "open" ? "Tanpa Password" : copied ? "✓ Password Tersalin" : "Copy Password"}</button><button className="connect-button" onClick={connectWifi} disabled={connecting}>{connecting ? "Menyiapkan panduan…" : "Bantu Hubungkan WiFi"}</button></div>
    {connectHelp && <div role="status" className="device-tip"><p>{connectHelp}</p></div>}
    {card.instructions && <div className="instructions"><strong>Cara terhubung</strong><p>{card.instructions}</p></div>}<div className="device-tip"><strong>{device === "ios" ? "iPhone / iPad" : device === "android" ? "Android" : "HP / Laptop"}</strong><p>{device === "ios" ? "Tap Bantu Hubungkan WiFi untuk menyalin password, lalu pilih jaringan ini di Settings → Wi-Fi." : device === "android" ? "Tap Bantu Hubungkan WiFi untuk menyalin password, lalu pilih jaringan ini di pengaturan Wi-Fi." : "Tap Bantu Hubungkan WiFi lalu pilih jaringan ini di pengaturan Wi-Fi perangkat."}</p></div>
    <p className="wifi-footer">WiV1 · WiFi access made simple</p>
  </div></main>;
}
