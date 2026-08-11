/**
 * ISO 4217 currency table.
 *
 * Every circulating world currency is listed here as a constant. `decimals` is the
 * ISO minor-unit exponent and is authoritative for all money arithmetic: a JPY amount
 * has no fractional part, a KWD amount has three. Never assume 2.
 *
 * Fund codes (BOV, CHE, CLF, MXV, UYI, ...) and metals (XAU, XAG, ...) are deliberately
 * excluded — they are not spendable money and would only clutter the picker.
 */

export interface CurrencyDef {
  /** ISO 4217 alphabetic code, e.g. "USD". */
  readonly code: string
  /** Display name, e.g. "US Dollar". */
  readonly name: string
  /** Display symbol. Falls back to the code where no distinct symbol exists. */
  readonly symbol: string
  /** ISO 4217 minor-unit exponent: 0, 2, 3 or 4. */
  readonly decimals: number
}

export const CURRENCIES = {
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  AFN: { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', decimals: 2 },
  ALL: { code: 'ALL', name: 'Albanian Lek', symbol: 'L', decimals: 2 },
  AMD: { code: 'AMD', name: 'Armenian Dram', symbol: '֏', decimals: 2 },
  ANG: { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', decimals: 2 },
  AOA: { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', decimals: 2 },
  ARS: { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimals: 2 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  AWG: { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', decimals: 2 },
  AZN: { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', decimals: 2 },
  BAM: { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', decimals: 2 },
  BBD: { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', decimals: 2 },
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  BGN: { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2 },
  BHD: { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', decimals: 3 },
  BIF: { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', decimals: 0 },
  BMD: { code: 'BMD', name: 'Bermudian Dollar', symbol: 'BD$', decimals: 2 },
  BND: { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', decimals: 2 },
  BOB: { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', decimals: 2 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  BSD: { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', decimals: 2 },
  BTN: { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', decimals: 2 },
  BWP: { code: 'BWP', name: 'Botswanan Pula', symbol: 'P', decimals: 2 },
  BYN: { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', decimals: 2 },
  BZD: { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', decimals: 2 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  CDF: { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', decimals: 2 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimals: 0 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  COP: { code: 'COP', name: 'Colombian Peso', symbol: '$', decimals: 2 },
  CRC: { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', decimals: 2 },
  CUP: { code: 'CUP', name: 'Cuban Peso', symbol: '$', decimals: 2 },
  CVE: { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', decimals: 2 },
  CZK: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
  DJF: { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', decimals: 0 },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  DOP: { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', decimals: 2 },
  DZD: { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', decimals: 2 },
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  ERN: { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', decimals: 2 },
  ETB: { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  FJD: { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', decimals: 2 },
  FKP: { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£', decimals: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  GEL: { code: 'GEL', name: 'Georgian Lari', symbol: '₾', decimals: 2 },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2 },
  GIP: { code: 'GIP', name: 'Gibraltar Pound', symbol: '£', decimals: 2 },
  GMD: { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', decimals: 2 },
  GNF: { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', decimals: 0 },
  GTQ: { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', decimals: 2 },
  GYD: { code: 'GYD', name: 'Guyanaese Dollar', symbol: 'G$', decimals: 2 },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  HNL: { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', decimals: 2 },
  HTG: { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', decimals: 2 },
  HUF: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2 },
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2 },
  ILS: { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  IQD: { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د', decimals: 3 },
  IRR: { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', decimals: 2 },
  ISK: { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', decimals: 0 },
  JMD: { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', decimals: 2 },
  JOD: { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', decimals: 3 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  KGS: { code: 'KGS', name: 'Kyrgystani Som', symbol: 'с', decimals: 2 },
  KHR: { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', decimals: 2 },
  KMF: { code: 'KMF', name: 'Comorian Franc', symbol: 'CF', decimals: 0 },
  KPW: { code: 'KPW', name: 'North Korean Won', symbol: '₩', decimals: 2 },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3 },
  KYD: { code: 'KYD', name: 'Cayman Islands Dollar', symbol: 'CI$', decimals: 2 },
  KZT: { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', decimals: 2 },
  LAK: { code: 'LAK', name: 'Laotian Kip', symbol: '₭', decimals: 2 },
  LBP: { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', decimals: 2 },
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
  LRD: { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', decimals: 2 },
  LSL: { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', decimals: 2 },
  LYD: { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د', decimals: 3 },
  MAD: { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', decimals: 2 },
  MDL: { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', decimals: 2 },
  MGA: { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', decimals: 2 },
  MKD: { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', decimals: 2 },
  MMK: { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', decimals: 2 },
  MNT: { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', decimals: 2 },
  MOP: { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', decimals: 2 },
  MRU: { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', decimals: 2 },
  MUR: { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', decimals: 2 },
  MVR: { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: '.ރ', decimals: 2 },
  MWK: { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', decimals: 2 },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimals: 2 },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  MZN: { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimals: 2 },
  NAD: { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimals: 2 },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  NIO: { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', decimals: 2 },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2 },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  OMR: { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimals: 3 },
  PAB: { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', decimals: 2 },
  PEN: { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimals: 2 },
  PGK: { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', decimals: 2 },
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2 },
  PLN: { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
  PYG: { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', decimals: 0 },
  QAR: { code: 'QAR', name: 'Qatari Rial', symbol: 'ر.ق', decimals: 2 },
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2 },
  RSD: { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', decimals: 2 },
  RUB: { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  RWF: { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', decimals: 2 },
  SBD: { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', decimals: 2 },
  SCR: { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', decimals: 2 },
  SDG: { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س.', decimals: 2 },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  SHP: { code: 'SHP', name: 'Saint Helena Pound', symbol: '£', decimals: 2 },
  SLE: { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le', decimals: 2 },
  SOS: { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', decimals: 2 },
  SRD: { code: 'SRD', name: 'Surinamese Dollar', symbol: '$', decimals: 2 },
  SSP: { code: 'SSP', name: 'South Sudanese Pound', symbol: '£', decimals: 2 },
  STN: { code: 'STN', name: 'São Tomé & Príncipe Dobra', symbol: 'Db', decimals: 2 },
  SVC: { code: 'SVC', name: 'Salvadoran Colón', symbol: '₡', decimals: 2 },
  SYP: { code: 'SYP', name: 'Syrian Pound', symbol: '£S', decimals: 2 },
  SZL: { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', decimals: 2 },
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  TJS: { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'ЅМ', decimals: 2 },
  TMT: { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'm', decimals: 2 },
  TND: { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', decimals: 3 },
  TOP: { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', decimals: 2 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  TTD: { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$', decimals: 2 },
  TWD: { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2 },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2 },
  UAH: { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2 },
  UGX: { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  UYU: { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimals: 2 },
  UZS: { code: 'UZS', name: 'Uzbekistani Som', symbol: "so'm", decimals: 2 },
  VED: { code: 'VED', name: 'Venezuelan Bolívar', symbol: 'Bs.', decimals: 2 },
  VES: { code: 'VES', name: 'Venezuelan Bolívar Soberano', symbol: 'Bs.S', decimals: 2 },
  VND: { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  VUV: { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', decimals: 0 },
  WST: { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', decimals: 2 },
  XAF: { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0 },
  XCD: { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$', decimals: 2 },
  XCG: { code: 'XCG', name: 'Caribbean Guilder', symbol: 'Cg', decimals: 2 },
  XOF: { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0 },
  XPF: { code: 'XPF', name: 'CFP Franc', symbol: '₣', decimals: 0 },
  YER: { code: 'YER', name: 'Yemeni Rial', symbol: '﷼', decimals: 2 },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  ZMW: { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2 },
  ZWG: { code: 'ZWG', name: 'Zimbabwe Gold', symbol: 'ZiG', decimals: 2 },
} as const satisfies Record<string, CurrencyDef>

/** Union of every supported currency code, e.g. `'USD' | 'EUR' | ...`. */
export type CurrencyCode = keyof typeof CURRENCIES

/** All currencies as a list, sorted by code — suitable for pickers. */
export const CURRENCY_LIST: readonly CurrencyDef[] = Object.values(CURRENCIES)

/** Codes commonly offered at the top of a picker before the full alphabetical list. */
export const POPULAR_CURRENCY_CODES: readonly CurrencyCode[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'TRY', 'MMK',
]

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value)
}

/** Look up a currency definition. Throws on an unknown code — callers must validate first. */
export function currency(code: CurrencyCode): CurrencyDef {
  const def = CURRENCIES[code]
  if (!def) throw new Error(`Unknown currency code: ${code}`)
  return def
}

/** Minor-unit exponent for a currency (2 for USD, 0 for JPY, 3 for KWD). */
export function decimalsOf(code: CurrencyCode): number {
  return currency(code).decimals
}

/**
 * Case-insensitive search over code and name, for the currency picker's search bar.
 * Exact code matches sort first, then prefix matches, then substring matches.
 */
export function searchCurrencies(query: string): readonly CurrencyDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return CURRENCY_LIST

  const scored: { def: CurrencyDef; score: number }[] = []
  for (const def of CURRENCY_LIST) {
    const code = def.code.toLowerCase()
    const name = def.name.toLowerCase()
    let score = -1
    if (code === q) score = 0
    else if (code.startsWith(q)) score = 1
    else if (name.startsWith(q)) score = 2
    else if (name.includes(q)) score = 3
    if (score >= 0) scored.push({ def, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.def.code.localeCompare(b.def.code))
    .map((s) => s.def)
}
