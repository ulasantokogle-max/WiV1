"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Card = {
  id: string; business_id: string; card_code: string; slug: string; status: string;
  businesses: { name: string } | null; locations: { name: string } | null;
  wifi_networks: { ssid: string; security_type: string; instructions?: string } | null;
};
type Business = { id: string; name: string; status: string };
type Stats = Record<string, { views: number; qr: number; nfc: number; copies: number; connects: number }>;
type EditForm = { ssid: string; password: string; securityType: "WPA2" | "WPA3" | "Open"; instructions: string };

export default function ClientDashboard() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [register, setRegister] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm>({ ssid: "", password: "", securityType: "WPA2", instructions: "" });
  const [saving, setSaving] = useState(false);

  async function load(): Promise<boolean> {
    const response = await fetch("/api/client/cards", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) {
      setMessage(json.error || "Akses client tidak tersedia");
      setCards([]); setBusinesses([]); return false;
    }
    setCards(json.data.cards); setBusinesses(json.data.businesses); setStats(json.data.analytics);
    setMessage("");
    return true;
  }
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) setLoggedIn(await load());
      else setLoggedIn(false);
      if (active) setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (submittingAuth) return;
    setSubmittingAuth(true);
    setMessage("");
    try {
      if (register) {
        if (password.length < 8) { setMessage("Password minimal 8 karakter."); return; }
        if (password !== confirmPassword) { setMessage("Konfirmasi password belum sama."); return; }
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin + "/auth/callback" },
        });
        if (error) { setMessage(error.message); return; }
        setPassword(""); setConfirmPassword(""); setVerificationSent(true);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setMessage(error.message); return; }
      setPassword("");
      if (await load()) setLoggedIn(true);
      else setLoggedIn(false);
    } catch {
      setMessage("Tidak dapat menghubungi layanan login WiV1. Periksa koneksi internet dan coba lagi.");
    } finally {
      setSubmittingAuth(false);
    }
  }

  async function resendVerification() {
    if (submittingAuth || !email.trim()) return;
    setSubmittingAuth(true); setMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      setMessage(error ? error.message : "Jika akun masih membutuhkan verifikasi, tautan baru telah dikirim. Periksa Inbox dan Spam.");
    } catch {
      setMessage("Gagal menghubungi layanan email. Coba lagi atau masuk jika sudah terverifikasi.");
    } finally {
      setSubmittingAuth(false);
    }
  }

  function selectCard(card: Card) {
    setSelected(card.slug); setMessage(""); setShowWifiPassword(false);
    setEdit({ ssid: card.wifi_networks?.ssid || "", password: "",
      securityType: (card.wifi_networks?.security_type || "WPA2") as EditForm["securityType"],
      instructions: card.wifi_networks?.instructions || "" });
  }
  async function copyNfcUrl(slug: string) {
    const url = new URL("/wifi/" + encodeURIComponent(slug), window.location.origin);
    url.searchParams.set("src", "nfc");
    try {
      await navigator.clipboard.writeText(url.toString());
      setMessage("URL NFC disalin. URL Preview hanya untuk pengujian, belum untuk kartu permanen.");
    } catch {
      setMessage("Clipboard tidak tersedia. Salin alamat dari browser secara manual.");
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/client/cards/" + encodeURIComponent(selected), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit),
      });
      const json = await response.json();
      if (!response.ok || !json.success) setMessage(json.error || "Gagal menyimpan");
      else { await load(); setMessage("Pengaturan WiFi berhasil disimpan."); }
    } catch { setMessage("Koneksi bermasalah. Silakan coba lagi."); }
    finally { setSaving(false); }
  }
  const totals = Object.values(stats).reduce((sum, item) => ({
    views: sum.views + item.views, qr: sum.qr + item.qr, nfc: sum.nfc + item.nfc,
  }), { views: 0, qr: 0, nfc: 0 });
  if (loading) return <main className="container page"><p>Memuat dashboard client…</p></main>;

  if (!loggedIn && verificationSent) return <main className="auth-page" style={{ padding: "24px 16px" }}>
    <section className="auth-card" style={{ width: "100%", maxWidth: 460, padding: "34px 30px" }}>
      <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 22 }}>Wi</div>
      <p className="eyebrow">WIV1 · VERIFIKASI AKUN</p>
      <div style={{ borderRadius: "50%", background: "#eaf1fe", color: "#163c83", fontSize: 25,
        display: "grid", placeItems: "center", width: 54, height: 54, margin: "18px 0" }}>✉</div>
      <h1 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 10 }}>Periksa email Anda</h1>
      <p className="muted" style={{ lineHeight: 1.7 }}>Kami telah memproses permintaan pendaftaran untuk:</p>
      <div style={{ padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: 12,
        fontWeight: 750, margin: "14px 0 22px", overflowWrap: "anywhere", background: "#f8fafc" }}>{email.trim()}</div>
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>1. Buka Inbox atau folder Spam.</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>2. Klik tombol verifikasi dalam email WiV1 / Supabase Auth.</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>3. Kembali dan masuk ke Dashboard Client.</p>
      </div>
      <button type="button" style={{ width: "100%" }} onClick={() => {
        setVerificationSent(false); setRegister(false); setMessage("");
      }}>Sudah Verifikasi? Masuk Client</button>
      <button type="button" className="secondary" style={{ width: "100%", marginTop: 10 }}
        onClick={() => void resendVerification()} disabled={submittingAuth}>
        {submittingAuth ? "Mengirim…" : "Kirim Ulang Email Verifikasi"}
      </button>
      {message && <div className="device-tip" role="status" style={{ marginTop: 12 }}>{message}</div>}
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 20 }}>
        Jika tautan lama membuka localhost, akun mungkin sudah terverifikasi. Coba masuk terlebih dahulu.
      </p>
    </section>
  </main>;

  if (!loggedIn) return <main className="auth-page"><div className="auth-card">
    <div className="brand-mark">Wi</div><p className="eyebrow">WIV1 / CLIENT</p>
    <h1>{register ? "Daftar Owner Bisnis" : "Masuk Client"}</h1>
    <p className="muted">Dashboard pribadi untuk melihat kartu, statistik, dan mengatur WiFi bisnis Anda.</p>
    <form className="form" onSubmit={authenticate}>
      <input required type="email" placeholder="Email owner" value={email} onChange={event => setEmail(event.target.value)}/>
      <input required type={showPassword ? "text" : "password"} minLength={register ? 8 : undefined}
        autoComplete={register ? "new-password" : "current-password"} placeholder="Password"
        value={password} onChange={event => setPassword(event.target.value)}/>
      {register && <input required type={showPassword ? "text" : "password"} minLength={8}
        autoComplete="new-password" placeholder="Ulangi password" value={confirmPassword}
        onChange={event => setConfirmPassword(event.target.value)}/>}
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#475467"}}>
        <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)}
          style={{width:16,height:16}}/> Tampilkan password
      </label>
      <button type="submit" disabled={submittingAuth}>{submittingAuth ? "Memproses…" : (register ? "Daftar & Verifikasi Email" : "Masuk ke Dashboard Client")}</button>
    </form>
    <button className="secondary" style={{ marginTop: 12, width: "100%" }} onClick={() => { setRegister(!register); setMessage(""); }}>
      {register ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
    </button>
    {message && <p className="device-tip">{message}</p>}
    <p className="muted" style={{ fontSize: 12 }}>Akun harus dihubungkan ke bisnis oleh Provider. Akun Client tidak dapat mengakses dashboard Provider.</p>
  </div></main>;

  return <main className="container page">
    <header className="dashboard-head"><div>
      <p className="eyebrow">WIV1 / CLIENT DASHBOARD</p><h1>Bisnis Saya</h1>
      <p className="muted">Kartu NFC + QR dan pengaturan jaringan WiFi bisnis Anda.</p>
    </div><div className="head-actions">
      <button className="secondary" onClick={() => void load()}>Refresh</button>
      <button className="secondary" onClick={async () => { await supabase.auth.signOut(); setLoggedIn(false); setCards([]); }}>Logout</button>
    </div></header>
    <section className="stats-grid">
      <div className="stat"><span>Bisnis</span><strong>{businesses.length}</strong></div>
      <div className="stat"><span>Total Cards</span><strong>{cards.length}</strong></div>
      <div className="stat"><span>Page Views</span><strong>{totals.views}</strong></div>
      <div className="stat"><span>QR Scans</span><strong>{totals.qr}</strong></div>
      <div className="stat"><span>NFC Scans</span><strong>{totals.nfc}</strong></div>
    </section>
    {message && <div className="panel" role="status" style={{ marginBottom: 16 }}>{message}</div>}
    {!businesses.length && <section className="panel"><h2>Belum ada bisnis</h2>
      <p className="muted">Akun sudah aktif. Minta Provider menghubungkan email login ini dengan bisnis Anda. Tidak perlu membuat akun baru.</p></section>}
    {businesses.map(business => <section key={business.id} className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head"><div><p className="eyebrow">BISNIS SAYA</p><h2>{business.name}</h2></div>
        <span className="badge active">{business.status}</span></div>
      <div className="table-wrap"><table><thead><tr>
        <th>Kartu</th><th>SSID</th><th>Status</th><th>Analytics</th><th></th>
      </tr></thead><tbody>{cards.filter(card => card.business_id === business.id).map(card => <tr key={card.id}>
        <td><strong>{card.card_code}</strong><div className="mono">{card.locations?.name}</div></td>
        <td>{card.wifi_networks?.ssid}<div className="muted">{card.wifi_networks?.security_type}</div></td>
        <td><span className={"badge " + card.status}>{card.status}</span></td>
        <td>{stats[card.id]?.qr ?? 0} QR · {stats[card.id]?.nfc ?? 0} NFC</td>
        <td><button className="secondary small" onClick={() => selectCard(card)}>Kelola WiFi</button>
          <a className="button small secondary" style={{ marginLeft: 8 }} target="_blank" rel="noreferrer" href={"/wifi/" + encodeURIComponent(card.slug)}>Lihat Publik</a>
          <a className="button small secondary" style={{ marginLeft: 8 }} href={"/api/qr/" + encodeURIComponent(card.slug)} download={card.card_code + "-QR.png"}>Download QR</a>
          <a className="button small secondary" style={{ marginLeft: 8 }} target="_blank" rel="noreferrer" href={"/client/cards/" + encodeURIComponent(card.slug) + "/print"}>Print Card</a>
          <button className="small secondary" style={{ marginLeft: 8, marginTop: 6 }} onClick={() => void copyNfcUrl(card.slug)}>Copy NFC URL</button></td>
      </tr>)}</tbody></table></div>
    </section>)}
    {selected && <section className="panel" style={{ maxWidth: 650 }}>
      <div className="panel-head"><h2>Pengaturan WiFi · {selected}</h2>
        <button className="secondary small" onClick={() => setSelected(null)}>Tutup</button></div>
      <form className="form" onSubmit={saveSettings}>
        <label>Nama WiFi / SSID</label><input required maxLength={100} value={edit.ssid}
          onChange={event => setEdit(prev => ({ ...prev, ssid: event.target.value }))}/>
        <label>Keamanan</label><select value={edit.securityType}
          onChange={event => setEdit(prev => ({ ...prev, securityType: event.target.value as EditForm["securityType"], password: "" }))}>
          <option>WPA2</option><option>WPA3</option><option>Open</option>
        </select>
        {edit.securityType !== "Open" && <>
          <label>Password WiFi baru</label>
          <div style={{ position: "relative" }}>
            <input type={showWifiPassword ? "text" : "password"} autoComplete="new-password"
              placeholder="Kosongkan jika password tidak berubah" value={edit.password}
              onChange={event => setEdit(prev => ({ ...prev, password: event.target.value }))}
              style={{ width: "100%", paddingRight: 48 }}/>
            <button type="button"
              aria-label={showWifiPassword ? "Sembunyikan password WiFi" : "Tampilkan password WiFi"}
              aria-pressed={showWifiPassword}
              title={showWifiPassword ? "Sembunyikan password" : "Intip password"}
              onClick={() => setShowWifiPassword(value => !value)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, padding: 4, background: "transparent",
                border: "none", boxShadow: "none", color: "#475467", cursor: "pointer" }}>
              {showWifiPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A11 11 0 0112 4c5 0 9.3 3.1 11 8a11.7 11.7 0 01-2.3 3.9M6.6 6.6A12.2 12.2 0 002 12c1.7 4.9 6 8 10 8 1.6 0 3.2-.4 4.6-1.1"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12c1.7-4.9 6-8 10-8s8.3 3.1 10 8c-1.7 4.9-6 8-10 8S3.7 16.9 2 12z"
                    stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Wajib diisi ketika mengubah jaringan Open menjadi WPA.</p>
        </>}
        <label>Instruksi untuk pelanggan</label><textarea rows={4} maxLength={2000} value={edit.instructions}
          onChange={event => setEdit(prev => ({ ...prev, instructions: event.target.value }))}/>
        <button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pengaturan WiFi"}</button>
      </form>
    </section>}
  </main>;
}
