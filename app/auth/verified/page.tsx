import Link from "next/link";

export const metadata = {
  title: "Verifikasi Akun | WiV1",
  robots: { index: false, follow: false },
};

export default async function VerifiedPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const verified = status === "success";
  const title = verified ? "Email berhasil diverifikasi" : "Periksa verifikasi email";
  const description = verified
    ? "Akun WiV1 Anda siap digunakan. Masuk ke Dashboard Client untuk melihat dan mengelola kartu WiFi bisnis setelah Provider menghubungkan akun Anda."
    : status === "unavailable"
      ? "Layanan verifikasi sedang tidak dapat dihubungi. Coba masuk menggunakan akun yang sudah didaftarkan. Jika belum berhasil, minta tautan verifikasi baru."
      : "Tautan mungkin kedaluwarsa, sudah digunakan, atau tidak sesuai. Jika email sudah terverifikasi, Anda dapat langsung masuk ke Dashboard Client.";

  return <main className="auth-page" style={{ padding: "32px 16px", minHeight: "100vh" }}>
    <section className="auth-card" style={{ maxWidth: 480, width: "100%", padding: "36px 30px" }}>
      <div className="brand-mark" style={{ width: 46, height: 46, borderRadius: 12, marginBottom: 24 }}>Wi</div>
      <p className="eyebrow" style={{ letterSpacing: "0.13em" }}>WIV1 · KEAMANAN AKUN</p>
      <div role="status" aria-label={verified ? "Verifikasi berhasil" : "Status verifikasi"}
        style={{ width: 52, height: 52, display: "grid", placeItems: "center", fontSize: 26,
          background: verified ? "#e7f6ee" : "#fff3df", color: verified ? "#18794e" : "#a15c0b",
          borderRadius: "50%", margin: "14px 0" }}>{verified ? "✓" : "!"}</div>
      <h1 style={{ fontSize: 27, lineHeight: 1.16, marginBottom: 12 }}>{title}</h1>
      <p className="muted" style={{ lineHeight: 1.75, marginBottom: 24 }}>{description}</p>
      <Link href="/client" className="button" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 12 }}>
        Masuk Dashboard Client
      </Link>
      <Link href="/" className="button secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
        Kembali ke Beranda
      </Link>
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #e4e7ec", textAlign: "center" }}>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          WiV1 · Kartu WiFi NFC + QR · Akun Client terpisah dari YukReview
        </p>
      </div>
    </section>
  </main>;
}
