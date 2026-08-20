import type { Restaurant } from "./types";

function restaurantWeight(restaurant: Restaurant, recentIds: Set<string>) {
  const distanceWeight = Math.max(0.25, 1.25 - restaurant.distance / 4000);
  const ratingWeight = restaurant.rating ? Math.max(0.8, restaurant.rating / 4) : 1;
  const openWeight = restaurant.openNow === false ? 0 : 1;
  const freshnessWeight = recentIds.has(restaurant.id) ? 0.18 : 1;

  return distanceWeight * ratingWeight * openWeight * freshnessWeight;
}

export function pickRestaurant(restaurants: Restaurant[], recentIds: string[]) {
  const eligible = restaurants.filter((restaurant) => restaurant.openNow !== false);
  if (eligible.length === 0) return null;

  const recentSet = new Set(recentIds.slice(0, 5));
  const weights = eligible.map((restaurant) => restaurantWeight(restaurant, recentSet));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * total;

  for (let index = 0; index < eligible.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return eligible[index];
  }

  return eligible.at(-1) ?? null;
}
