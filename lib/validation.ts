import { z } from "zod";

export const eventSchema = z.object({
  cardId: z.string().uuid(),
  eventType: z.enum(["page_view", "qr_scan", "nfc_scan", "password_copy", "wifi_connect"]),
  source: z.enum(["qr", "nfc", "direct", "unknown"]).default("unknown"),
});
