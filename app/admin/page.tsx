"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

type Card = { id: string; card_code: string; slug: string; status: string; created_at: string; business_id: string; assigned: boolean; businesses: { name: string } | null; locations: { name: string } | null; wifi_networks: { ssid: string; security_type: string } | null };
type Analytics = Record<string, { pageViews: number; qrScans: number; nfcScans: number; passwordCopies: number; lastActivity: string | null }>;

export default function AdminPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false); const [loading, setLoading] = useState(true); const [loggingIn, setLoggingIn] = useState(false); const [message, setMessage] = useState("");
  const [ownerEmails, setOwnerEmails] = useState<Record<string,string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]); const [analytics, setAnalytics] = useState<Analytics>({}); const [search, setSearch] = useState("");
  const [form, setForm] = useState({ businessName: "", locationName: "", address: "", cardCode: "", slug: "", ssid: "", password: "", securityType: "WPA2", instructions: "" });

  async function loadCards(): Promise<boolean> {
    const res = await fetch("/api/admin/cards", { cache: "no-store" }); const json = await res.json();
    if (!json.success) { setMessage("Akses Provider ditolak. Gunakan dashboard Client jika Anda pemilik bisnis."); return false; }
    setCards(json.data.cards); setAnalytics(json.data.analytics); return true;
  }
  useEffect(() => { supabase.auth.getUser().then(async ({ data }) => { if (data.user && await loadCards()) setLoggedIn(true); setLoading(false); }).catch(() => setLoading(false)); }, [supabase]);
  useEffect(() => { if (loggedIn) loadCards(); }, [loggedIn]);

  async function login(e: FormEvent) {
    e.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (/failed to fetch|network|fetch failed/i.test(error.message)) {
          setMessage("Tidak bisa menghubungi server login WiV1. Periksa koneksi internet, coba nonaktifkan VPN/adblock sementara, lalu coba ulang. Jika masih gagal, cek konfigurasi Supabase di deployment ini.");
        } else {
          setMessage(error.message);
        }
        return;
      }
      if (await loadCards()) { setLoggedIn(true); setPassword(""); }
    } catch {
      setMessage("Server login WiV1 tidak dapat dihubungi. Coba buka ulang halaman, cek jaringan, lalu hubungi Provider bila tetap gagal. Password Anda tidak diubah.");
    } finally {
      setLoggingIn(false);
    }
  }
  async function createCard(e: FormEvent) { e.preventDefault(); setMessage(""); const res = await fetch("/api/admin/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const json = await res.json(); if (!json.success) return setMessage(json.error || "Gagal membuat kartu"); router.push(`/admin/cards/${json.data.slug}`); }

  async function assignOwner(businessId: string) {
    const ownerEmail = ownerEmails[businessId]?.trim();
    if (!ownerEmail) { setMessage("Masukkan email Client yang sudah terverifikasi."); return; }
    setAssigning(businessId); setMessage("");
    try {
      const response = await fetch("/api/provider/assign-owner", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, email: ownerEmail }) });
      const json = await response.json();
      if (!response.ok || !json.success) setMessage(json.error || "Gagal menghubungkan Client");
      else { setMessage("Owner berhasil dihubungkan. Provider sekarang hanya monitoring untuk bisnis tersebut."); await loadCards(); }
    } catch { setMessage("Koneksi bermasalah. Silakan coba lagi."); }
    finally { setAssigning(null); }
  }

  const totals = useMemo(() => cards.reduce((a, c) => { const x = analytics[c.id]; a.views += x?.pageViews || 0; a.qr += x?.qrScans || 0; a.nfc += x?.nfcScans || 0; a.copies += x?.passwordCopies || 0; return a; }, { views: 0, qr: 0, nfc: 0, copies: 0 }), [cards, analytics]);
  const filtered = cards.filter(c => `${c.card_code} ${c.slug} ${c.businesses?.name ?? ""} ${c.locations?.name ?? ""} ${c.wifi_networks?.ssid ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <main className="container page"><div className="skeleton">Loading WiV1…</div></main>;
  if (!loggedIn) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">Wi</div><p className="eyebrow">WIV1 / PROVIDER</p><h1>Provider Dashboard</h1><p className="muted">Login khusus Provider untuk membuat kartu, menghubungkan owner, dan memantau statistik bisnis.</p><form onSubmit={login} className="form"><input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /><button type="submit" disabled={loggingIn}>{loggingIn ? "Menghubungkan…" : "Masuk ke Dashboard"}</button></form>{message && <p className="error">{message}</p>}<p className="muted" style={{marginTop:14,fontSize:13}}>Pemilik bisnis? <a href="/client" style={{textDecoration:"underline"}}>Masuk Dashboard Client</a></p></div></main>;

  return <main className="container page">
    <header className="dashboard-head"><div><p className="eyebrow">WIV1 / PROVIDER DASHBOARD</p><h1>Provider WiFi Cards</h1><p className="muted">Provisioning kartu, hubungkan akun client, dan monitoring aktivitas.</p></div><div className="head-actions"><button onClick={() => router.push("/provider/cards/new")}>+ Buat Card</button><button className="secondary" onClick={() => router.push("/provider/analytics")}>Analytics</button><button className="secondary" onClick={() => supabase.auth.signOut().then(() => setLoggedIn(false))}>Logout</button></div></header>
    <section className="stats-grid"><Stat label="Total Cards" value={cards.length}/><Stat label="Page Views" value={totals.views}/><Stat label="QR Scans" value={totals.qr}/><Stat label="NFC Scans" value={totals.nfc}/><Stat label="Password Copies" value={totals.copies}/></section>
    <section className="panel"><div className="panel-head"><div><h2>Semua WiFi Cards</h2><p className="muted">Satu dashboard untuk seluruh kartu.</p></div><input className="search" placeholder="Cari card, bisnis, SSID…" value={search} onChange={e => setSearch(e.target.value)}/></div>
      <div className="table-wrap"><table><thead><tr><th>Card</th><th>Business / Location</th><th>WiFi</th><th>Status</th><th>Activity</th><th>Owner Client</th><th></th></tr></thead><tbody>{filtered.map(card => { const a = analytics[card.id] || { pageViews: 0, qrScans: 0, nfcScans: 0, passwordCopies: 0 }; return <tr key={card.id}><td><strong>{card.card_code}</strong><br/><span className="mono">/{card.slug}</span></td><td>{card.businesses?.name}<br/><span className="muted">{card.locations?.name}</span></td><td>{card.wifi_networks?.ssid}<br/><span className="muted">{card.wifi_networks?.security_type}</span></td><td><span className={`badge ${card.status}`}>{card.status}</span></td><td>{a.qrScans} QR · {a.nfcScans} NFC<br/><span className="muted">{a.passwordCopies} copy</span></td><td>{card.assigned ? <span className="badge active">Owner terhubung</span> :
      <div style={{minWidth:170,display:"flex",flexDirection:"column",gap:6}}>
        <input aria-label={"Email Client untuk " + card.card_code} type="email" placeholder="Email Client terverifikasi"
          value={ownerEmails[card.business_id] || ""} onChange={event => setOwnerEmails(prev => ({...prev,[card.business_id]:event.target.value}))}
          style={{border:"1px solid #d0d5dd",borderRadius:8,padding:8,maxWidth:205}}/>
        <button className="small secondary" disabled={assigning === card.business_id} onClick={() => void assignOwner(card.business_id)}>
          {assigning === card.business_id ? "Menghubungkan…" : "Hubungkan Client"}</button>
      </div>}</td><td><button className="small secondary" onClick={() => router.push(`/provider/cards/${card.slug}`)}>{card.assigned ? "Monitoring" : "Kelola"}</button></td></tr>; })}</tbody></table>{!filtered.length && <div className="empty">Belum ada WiFi Card.</div>}</div>
    </section>
  </main>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="stat"><span>{label}</span><strong>{value.toLocaleString("id-ID")}</strong></div>; }
