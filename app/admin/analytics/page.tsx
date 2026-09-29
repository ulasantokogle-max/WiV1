"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

type Row = { card_id: string; card_code: string; slug: string; business: string; views: number; qr: number; nfc: number; copies: number; connects: number };

export default function AnalyticsPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.replace("/admin"); return; }
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) setError(json.error || "Gagal memuat analytics");
      else setRows(json.data.rows);
      setLoading(false);
    })();
  }, [router, supabase]);

  const totals = rows.reduce((a, r) => ({ views: a.views+r.views, qr:a.qr+r.qr, nfc:a.nfc+r.nfc, copies:a.copies+r.copies, connects:a.connects+r.connects }), {views:0,qr:0,nfc:0,copies:0,connects:0});

  if (loading) return <main className="container page"><p>Loading analytics…</p></main>;
  return <main className="container page">
    <header className="dashboard-head"><div><p className="eyebrow">WIV1 / ANALYTICS</p><h1>Performance</h1><p className="muted">Ringkasan aktivitas semua WiFi Card.</p></div><button className="secondary" onClick={() => router.push("/admin")}>← Dashboard</button></header>
    {error && <div className="panel error" style={{marginBottom:18}}>{error}</div>}
    <section className="stats-grid"><Stat label="Page Views" value={totals.views}/><Stat label="QR Scans" value={totals.qr}/><Stat label="NFC Scans" value={totals.nfc}/><Stat label="Password Copies" value={totals.copies}/><Stat label="Connect Attempts" value={totals.connects}/></section>
    <section className="panel"><div className="panel-head"><div><h2>Per Card</h2><p className="muted">Data event tersimpan dari QR, NFC, dan landing page.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Card</th><th>Business</th><th>Views</th><th>QR</th><th>NFC</th><th>Copy</th><th>Connect</th></tr></thead><tbody>{rows.map(r => <tr key={r.card_id}><td><strong>{r.card_code}</strong><br/><span className="mono">/{r.slug}</span></td><td>{r.business}</td><td>{r.views}</td><td>{r.qr}</td><td>{r.nfc}</td><td>{r.copies}</td><td>{r.connects}</td></tr>)}</tbody></table>{!rows.length && <div className="empty">Belum ada data.</div>}</div>
    </section>
  </main>;
}
function Stat({label,value}:{label:string;value:number}) { return <div className="stat"><span>{label}</span><strong>{value.toLocaleString("id-ID")}</strong></div>; }
