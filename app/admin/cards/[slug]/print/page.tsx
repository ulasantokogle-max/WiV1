"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Card = {
  card_code: string;
  slug: string;
  businesses: { name: string; logo_url?: string } | null;
  locations: { name: string; address?: string } | null;
  wifi_networks: { ssid: string; security_type: string; instructions?: string } | null;
};
type PrintSide = "front" | "back" | "both";

function NfcMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? "wiv1-nfc-mark small" : "wiv1-nfc-mark"} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M17 21c8-8 22-8 30 0M22 27c5.5-5.5 14.5-5.5 20 0M28 33c2.4-2.4 5.6-2.4 8 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M32 35v13" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="32" cy="49" r="3" fill="currentColor"/>
  </svg>;
}

export default function PrintCardPage() {
  const { slug } = useParams<{slug: string}>();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [printSide, setPrintSide] = useState<PrintSide>("both");

  useEffect(() => {
    let active = true;
    const listEndpoint = window.location.pathname.startsWith("/client/") ? "/api/client/cards" : "/api/admin/cards";
    fetch(listEndpoint, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Gagal memuat daftar kartu");
        return response.json();
      })
      .then(json => {
        if (!active) return;
        const found = json.data?.cards?.find((entry: Card) => entry.slug === slug);
        if (!found) setError("Kartu tidak ditemukan atau akses ditolak");
        else setCard(found);
      })
      .catch(() => { if (active) setError("Gagal memuat kartu. Pastikan sudah login sebagai admin."); });
    return () => { active = false; };
  }, [slug]);

  if (error) return <main className="print-page"><p className="print-error">{error}</p></main>;
  if (!card) return <main className="print-page"><p className="print-error">Menyiapkan desain kartu…</p></main>;

  const displayName = card.businesses?.name || "WiFi";
  const ssid = card.wifi_networks?.ssid || "WiFi Guest";
  const qrUrl = `/api/qr/${encodeURIComponent(card.slug)}`;
  return <main className="print-page wiv1-print-page">
    <div className="print-toolbar wiv1-print-toolbar">
      <label htmlFor="print-side">Sisi cetak</label>
      <select id="print-side" value={printSide} onChange={event => setPrintSide(event.target.value as PrintSide)}>
        <option value="both">Depan + Belakang</option>
        <option value="front">Depan saja</option>
        <option value="back">Belakang saja</option>
      </select>
      <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      <button type="button" className="secondary" onClick={() => window.close()}>Tutup</button>
    </div>
    <p className="wiv1-print-note">Ukuran jadi 70 × 70 mm per sisi · Cetak skala 100% / Actual size, tanpa Fit to Page. Penempatan chip NFC berada di belakang area TAP NFC.</p>
    <div className="wiv1-card-sheet">
      {(printSide === "front" || printSide === "both") && <div className="wiv1-side-wrap">
        <p className="wiv1-side-caption">DEPAN · 70 × 70 mm</p>
        <section className="wiv1-square-card wiv1-front" aria-label="Desain depan kartu WiFi">
          <div className="wiv1-card-top">
            <div className="wiv1-card-logo">Wi</div>
            <div className="wiv1-card-id"><strong>{displayName}</strong><span>WIFI ACCESS · NFC + QR</span></div>
          </div>
          <div className="wiv1-card-subtitle">Hubungkan ke WiFi tamu dengan mudah</div>
          <div className="wiv1-scan-grid">
            <div className="wiv1-scan-col">
              <div className="wiv1-qr-container"><img src={qrUrl} alt={`QR menuju halaman WiFi ${card.card_code}`} /></div>
              <strong>SCAN QR</strong><span>Kamera HP</span>
            </div>
            <div className="wiv1-scan-col">
              <div className="wiv1-tap-panel"><NfcMark/><strong>TAP NFC</strong><span>Tempelkan HP<br/>di sini</span></div>
              <strong>TAP NFC</strong><span>HP dengan NFC</span>
            </div>
          </div>
          <div className="wiv1-card-ssid"><span>JARINGAN WIFI</span><strong>{ssid}</strong><small>{card.wifi_networks?.security_type ?? "WPA2"}</small></div>
          <div className="wiv1-card-bottom"><span>{card.card_code}</span><strong>WiV1</strong></div>
        </section>
      </div>}
      {(printSide === "back" || printSide === "both") && <div className="wiv1-side-wrap">
        <p className="wiv1-side-caption">BELAKANG · 70 × 70 mm</p>
        <section className="wiv1-square-card wiv1-back" aria-label="Desain belakang dan posisi chip NFC">
          <div className="wiv1-back-title">WIFI ACCESS</div>
          <h2>{displayName}</h2>
          <p className="wiv1-back-location">{card.locations?.name || "Guest WiFi"}</p>
          <div className="wiv1-back-center">
            <div className="wiv1-chip-zone"><NfcMark small/><strong>POSISI CHIP NFC</strong><span>Tempel chip pada sisi dalam kartu, tepat di area ini</span></div>
            <div className="wiv1-back-guide"><strong>CARA PAKAI</strong><span>1. Scan QR atau tap NFC di sisi depan</span><span>2. Buka halaman WiFi</span><span>3. Ikuti petunjuk koneksi</span></div>
          </div>
          <div className="wiv1-back-footer"><span>{card.card_code}</span><strong>WiV1</strong></div>
        </section>
      </div>}
    </div>
    <p className="wiv1-print-note">Catatan: posisi chip pada desain belakang diasumsikan kartu dibalik kiri–kanan (flip horizontal). Buat uji cetak 1:1 sebelum produksi. URL masih Preview: jangan menulis NFC permanen atau mencetak massal.</p>
  </main>;
}
