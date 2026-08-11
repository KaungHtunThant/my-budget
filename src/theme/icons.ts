/**
 * Icon registry.
 *
 * Categories, wallets and goals store their icon as a *name* string, because that is what
 * a database row can hold. `ion-icon`'s `icon` property, however, expects the imported SVG
 * data — and its `name` property fetches the SVG over the network at runtime, which an
 * offline-first app must not rely on (it 404s with no assets served, leaving blank circles).
 *
 * So every icon a stored record may reference is imported and bundled here, and looked up
 * by name. Adding an icon to a picker means adding it to this registry too.
 */

import {
  airplaneOutline,
  bagHandleOutline,
  barChartOutline,
  basketOutline,
  boatOutline,
  briefcaseOutline,
  buildOutline,
  businessOutline,
  busOutline,
  cafeOutline,
  cameraOutline,
  carOutline,
  cardOutline,
  cashOutline,
  cellularOutline,
  constructOutline,
  cutOutline,
  ellipseOutline,
  ellipsisHorizontalOutline,
  filmOutline,
  fitnessOutline,
  flashOutline,
  flowerOutline,
  footballOutline,
  gameControllerOutline,
  giftOutline,
  globeOutline,
  hammerOutline,
  handLeftOutline,
  headsetOutline,
  heartOutline,
  helpCircleOutline,
  homeOutline,
  laptopOutline,
  libraryOutline,
  medkitOutline,
  musicalNotesOutline,
  pawOutline,
  peopleOutline,
  phonePortraitOutline,
  pricetagOutline,
  receiptOutline,
  repeatOutline,
  restaurantOutline,
  schoolOutline,
  shieldCheckmarkOutline,
  shirtOutline,
  sparklesOutline,
  subwayOutline,
  sunnyOutline,
  swapHorizontalOutline,
  trailSignOutline,
  trendingUpOutline,
  trophyOutline,
  umbrellaOutline,
  walletOutline,
  waterOutline,
  wifiOutline,
} from 'ionicons/icons'

export const ICON_REGISTRY: Readonly<Record<string, string>> = {
  'airplane-outline': airplaneOutline,
  'bag-handle-outline': bagHandleOutline,
  'bar-chart-outline': barChartOutline,
  'basket-outline': basketOutline,
  'boat-outline': boatOutline,
  'briefcase-outline': briefcaseOutline,
  'build-outline': buildOutline,
  'bus-outline': busOutline,
  'business-outline': businessOutline,
  'cafe-outline': cafeOutline,
  'camera-outline': cameraOutline,
  'car-outline': carOutline,
  'card-outline': cardOutline,
  'cash-outline': cashOutline,
  'cellular-outline': cellularOutline,
  'construct-outline': constructOutline,
  'cut-outline': cutOutline,
  'ellipse-outline': ellipseOutline,
  'ellipsis-horizontal-outline': ellipsisHorizontalOutline,
  'film-outline': filmOutline,
  'fitness-outline': fitnessOutline,
  'flash-outline': flashOutline,
  'flower-outline': flowerOutline,
  'football-outline': footballOutline,
  'game-controller-outline': gameControllerOutline,
  'gift-outline': giftOutline,
  'globe-outline': globeOutline,
  'hammer-outline': hammerOutline,
  'hand-left-outline': handLeftOutline,
  'headset-outline': headsetOutline,
  'heart-outline': heartOutline,
  'help-circle-outline': helpCircleOutline,
  'home-outline': homeOutline,
  'laptop-outline': laptopOutline,
  'library-outline': libraryOutline,
  'medkit-outline': medkitOutline,
  'musical-notes-outline': musicalNotesOutline,
  'paw-outline': pawOutline,
  'people-outline': peopleOutline,
  'phone-portrait-outline': phonePortraitOutline,
  'pricetag-outline': pricetagOutline,
  'receipt-outline': receiptOutline,
  'repeat-outline': repeatOutline,
  'restaurant-outline': restaurantOutline,
  'school-outline': schoolOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'shirt-outline': shirtOutline,
  'sparkles-outline': sparklesOutline,
  'subway-outline': subwayOutline,
  'sunny-outline': sunnyOutline,
  'swap-horizontal-outline': swapHorizontalOutline,
  'trail-sign-outline': trailSignOutline,
  'trending-up-outline': trendingUpOutline,
  'trophy-outline': trophyOutline,
  'umbrella-outline': umbrellaOutline,
  'wallet-outline': walletOutline,
  'water-outline': waterOutline,
  'wifi-outline': wifiOutline,
}

/** Resolve a stored icon name to bundled SVG data, falling back to a neutral tag. */
export function iconFor(name: string | undefined | null): string {
  if (!name) return pricetagOutline
  return ICON_REGISTRY[name] ?? pricetagOutline
}

/** Names offered in the category icon picker. */
export const CATEGORY_ICON_NAMES: readonly string[] = [
  'home-outline', 'basket-outline', 'bus-outline', 'restaurant-outline', 'flash-outline',
  'medkit-outline', 'film-outline', 'bag-handle-outline', 'school-outline', 'repeat-outline',
  'wallet-outline', 'laptop-outline', 'trending-up-outline', 'gift-outline', 'airplane-outline',
  'paw-outline', 'fitness-outline', 'cafe-outline', 'car-outline', 'phone-portrait-outline',
  'shirt-outline', 'game-controller-outline', 'musical-notes-outline', 'water-outline',
  'wifi-outline', 'people-outline', 'construct-outline', 'library-outline', 'cut-outline',
  'ellipsis-horizontal-outline',
]

/** Names offered in the savings-goal icon picker. */
export const GOAL_ICON_NAMES: readonly string[] = [
  'trophy-outline', 'umbrella-outline', 'laptop-outline', 'airplane-outline', 'home-outline',
  'car-outline', 'school-outline', 'gift-outline', 'heart-outline', 'camera-outline',
  'boat-outline', 'sparkles-outline', 'fitness-outline', 'globe-outline', 'briefcase-outline',
]
