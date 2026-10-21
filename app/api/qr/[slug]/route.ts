import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(`/wifi/${encodeURIComponent(slug)}?src=qr`, process.env.WIV1_BASE_URL ?? request.url).toString();
  const png = await QRCode.toBuffer(url, { type: "png", width: 900, margin: 2 });
 const pngBytes = Uint8Array.from(png);

return new NextResponse(pngBytes, {
  headers: {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  },
});
}
