"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Card = { card_code:string; slug:string; businesses:{name:string;logo_url?:string}|null; locations:{name:string;address?:string}|null; wifi_networks:{ssid:string;security_type:string;instructions?:string}|null };
export default function PrintCardPage() {
  const { slug } = useParams<{slug:string}>();
  const [card,setCard] = useState<Card|null>(null); const [error,setError]=useState("");
  useEffect(()=>{fetch("/api/admin/cards",{cache:"no-store"}).then(r=>r.json()).then(j=>{const found=j.data?.cards?.find((x:Card)=>x.slug===slug); if(!found)setError("Card tidak ditemukan"); else setCard(found);}).catch(()=>setError("Gagal memuat card"));},[slug]);
  if(error) return <main className="print-page"><div className="print-card"><h1>{error}</h1></div></main>;
  if(!card) return <main className="print-page"><div className="print-card"><p>Loading…</p></div></main>;
  const base = process.env.NEXT_PUBLIC_WIV1_BASE_URL || window.location.origin;
  const url = `${base}/wifi/${card.slug}?src=qr`;
  return <main className="print-page"><div className="print-toolbar"><button onClick={()=>window.print()}>Print / Save PDF</button><button className="secondary" onClick={()=>window.close()}>Tutup</button></div><section className="print-card"><div className="print-brand">WiV1</div>{card.businesses?.logo_url && <img className="print-logo" src={card.businesses.logo_url} alt=""/>}<p className="eyebrow">WIFI ACCESS</p><h1>{card.businesses?.name}</h1><p className="muted">{card.locations?.name}</p><img className="print-qr" src={`/api/qr/${encodeURIComponent(card.slug)}`} alt={`QR ${card.card_code}`}/><h2>Scan untuk terhubung WiFi</h2><div className="print-network"><span>Nama WiFi</span><strong>{card.wifi_networks?.ssid}</strong><small>{card.wifi_networks?.security_type}</small></div>{card.wifi_networks?.instructions && <div className="print-instructions"><strong>Cara terhubung</strong><p>{card.wifi_networks.instructions}</p></div>}<div className="print-url">{url.replace("?src=qr","")}</div><div className="print-footer">Card {card.card_code} · NFC & QR compatible</div></section></main>;
}
