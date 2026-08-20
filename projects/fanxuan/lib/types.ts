export type Restaurant = {
  id: string;
  name: string;
  address: string;
  location: string;
  distance: number;
  type: string;
  rating: number | null;
  cost: number | null;
  openNow: boolean | null;
  tel: string | null;
  detailUrl?: string;
};

export type PickHistoryItem = Restaurant & { pickedAt: number };
