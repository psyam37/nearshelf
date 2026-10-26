// Domain types shared across the app.
// These mirror the tables in supabase/migrations. Once you have a Supabase
// project running, you can also generate exact types with `npm run db:types`.

export const STOCK_LEVELS = ["in_stock", "low", "out_of_stock"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

export const REQUEST_STATUSES = ["pending", "confirmed", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface Pharmacy {
  id: string;
  ods_code: string | null;
  name: string;
  address_line: string;
  town: string;
  postcode: string;
  phone: string | null;
  opening_hours: Record<string, string>;
}

export interface Medicine {
  id: string;
  dmd_vmp_id: string | null;
  name: string;
  strength: string | null;
  form: string | null;
  equivalence_group: string;
  is_controlled: boolean;
}

export interface StockStatus {
  pharmacy_id: string;
  medicine_id: string;
  level: StockLevel;
  updated_at: string; // ISO timestamp
  updated_by: string | null;
}

// One row returned by the `nearby_stock` database function.
export interface NearbyStockResult {
  pharmacy_id: string;
  pharmacy_name: string;
  address_line: string;
  town: string;
  postcode: string;
  phone: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  medicine_id: string;
  medicine_name: string;
  level: StockLevel;
  updated_at: string;
}

export interface StockRequest {
  id: string;
  from_pharmacy_id: string;
  to_pharmacy_id: string;
  medicine_id: string;
  status: RequestStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
}
