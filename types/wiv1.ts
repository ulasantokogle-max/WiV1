export type WifiCard = {
  id: string;
  business_id: string;
  location_id: string | null;
  card_code: string;
  slug: string;
  status: "active" | "inactive" | "suspended";
};

export type PublicWifiCard = WifiCard & {
  business_name: string;
  logo_url: string | null;
  ssid: string;
  security_type: string;
  instructions: string | null;
};
