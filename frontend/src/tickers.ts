import type { Market } from './types'

export interface TickerOption {
  symbol: string
  name: string
}

// Static curated shortlists for the ticker autocomplete dropdown in
// AlarmForm — convenience only, not validation. The alarm's `ticker` field
// stays free text: the worker resolves/validates the real symbol against
// yfinance at fetch time (see root CLAUDE.md's data provider strategy), so
// anything typed here that isn't in the list is still accepted.
//
// Intentionally not exhaustive or provider-fed (see the decision recorded
// when this file was added): no free API gives a reliable full ticker
// directory across USA/BYMA/crypto, and building/maintaining a live feed
// for a personal, few-user app isn't worth the added backend/worker
// complexity. Extend by hand as needed; updating means a frontend rebuild.
export const TICKERS: Record<Market, TickerOption[]> = {
  USA: [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
    { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway (Class B)' },
    { symbol: 'AVGO', name: 'Broadcom Inc.' },
    { symbol: 'LLY', name: 'Eli Lilly and Co.' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'MA', name: 'Mastercard Inc.' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
    { symbol: 'XOM', name: 'Exxon Mobil Corp.' },
    { symbol: 'ORCL', name: 'Oracle Corp.' },
    { symbol: 'HD', name: 'Home Depot Inc.' },
    { symbol: 'COST', name: 'Costco Wholesale Corp.' },
    { symbol: 'PG', name: 'Procter & Gamble Co.' },
    { symbol: 'NFLX', name: 'Netflix Inc.' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
    { symbol: 'ABBV', name: 'AbbVie Inc.' },
    { symbol: 'BAC', name: 'Bank of America Corp.' },
    { symbol: 'KO', name: 'Coca-Cola Co.' },
    { symbol: 'PEP', name: 'PepsiCo Inc.' },
    { symbol: 'ADBE', name: 'Adobe Inc.' },
    { symbol: 'CRM', name: 'Salesforce Inc.' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
    { symbol: 'INTC', name: 'Intel Corp.' },
    { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
    { symbol: 'WMT', name: 'Walmart Inc.' },
    { symbol: 'DIS', name: 'Walt Disney Co.' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc.' },
    { symbol: 'PFE', name: 'Pfizer Inc.' },
    { symbol: 'T', name: 'AT&T Inc.' },
    { symbol: 'VZ', name: 'Verizon Communications Inc.' },
    { symbol: 'NKE', name: 'Nike Inc.' },
    { symbol: 'QCOM', name: 'Qualcomm Inc.' },
    { symbol: 'IBM', name: 'IBM Corp.' },
    { symbol: 'UBER', name: 'Uber Technologies Inc.' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
    { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
    { symbol: 'GLD', name: 'SPDR Gold Shares' },
  ],
  // Stored WITHOUT the ".BA" suffix — the worker's resolve_symbol()
  // (worker/worker/market.py) always appends ".BA" itself for any BYMA
  // alarm, local share or CEDEAR alike, before calling yfinance. Baking
  // ".BA" into an entry here would double it up (e.g. "AAPL.BA.BA") and
  // fail at fetch time — this bit the CEDEAR entries in an earlier
  // version of this file. Names are as of 2026; a few tickers get
  // renamed/relisted occasionally (BBAR was "Banco Francés" for years).
  BYMA: [
    // Merval / local shares
    { symbol: 'GGAL', name: 'Grupo Financiero Galicia' },
    { symbol: 'YPFD', name: 'YPF S.A.' },
    { symbol: 'PAMP', name: 'Pampa Energía' },
    { symbol: 'BMA', name: 'Banco Macro' },
    { symbol: 'TXAR', name: 'Ternium Argentina' },
    { symbol: 'ALUA', name: 'Aluar' },
    { symbol: 'CRES', name: 'Cresud' },
    { symbol: 'BBAR', name: 'BBVA Argentina' },
    { symbol: 'SUPV', name: 'Grupo Supervielle' },
    { symbol: 'TGSU2', name: 'Transportadora de Gas del Sur' },
    { symbol: 'TGNO4', name: 'Transportadora de Gas del Norte' },
    { symbol: 'EDN', name: 'Edenor' },
    { symbol: 'LOMA', name: 'Loma Negra' },
    { symbol: 'MIRG', name: 'Mirgor' },
    { symbol: 'CEPU', name: 'Central Puerto' },
    { symbol: 'COME', name: 'Sociedad Comercial del Plata' },
    { symbol: 'TECO2', name: 'Telecom Argentina' },
    { symbol: 'CVH', name: 'Cablevisión Holding' },
    { symbol: 'TRAN', name: 'Transener' },
    { symbol: 'VALO', name: 'Grupo Financiero Valores' },
    { symbol: 'MOLI', name: 'Molinos Río de la Plata' },
    { symbol: 'IRSA', name: 'IRSA Inversiones y Representaciones' },
    { symbol: 'IRCP', name: 'IRSA Propiedades Comerciales' },
    { symbol: 'BHIP', name: 'Banco Hipotecario' },
    { symbol: 'METR', name: 'Metrogas' },
    { symbol: 'LEDE', name: 'Ledesma' },
    { symbol: 'AGRO', name: 'Agrometal' },
    { symbol: 'DGCU2', name: 'Distribuidora de Gas Cuyana' },
    { symbol: 'GCLA', name: 'Grupo Clarín' },
    { symbol: 'SAMI', name: 'S.A. San Miguel' },
    { symbol: 'CADO', name: 'Carlos Casado' },
    { symbol: 'FERR', name: 'Ferrum' },
    { symbol: 'MORI', name: 'Morixe Hermanos' },
    // CEDEARs (depositary receipts of foreign companies)
    { symbol: 'AAPL', name: 'Apple Inc. (CEDEAR)' },
    { symbol: 'MSFT', name: 'Microsoft Corp. (CEDEAR)' },
    { symbol: 'AMZN', name: 'Amazon.com Inc. (CEDEAR)' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. (CEDEAR)' },
    { symbol: 'TSLA', name: 'Tesla Inc. (CEDEAR)' },
    { symbol: 'KO', name: 'Coca-Cola Co. (CEDEAR)' },
    { symbol: 'NVDA', name: 'NVIDIA Corp. (CEDEAR)' },
    { symbol: 'META', name: 'Meta Platforms Inc. (CEDEAR)' },
    { symbol: 'MELI', name: 'MercadoLibre Inc. (CEDEAR)' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co. (CEDEAR)' },
    { symbol: 'V', name: 'Visa Inc. (CEDEAR)' },
    { symbol: 'MA', name: 'Mastercard Inc. (CEDEAR)' },
    { symbol: 'DIS', name: 'Walt Disney Co. (CEDEAR)' },
    { symbol: 'NFLX', name: 'Netflix Inc. (CEDEAR)' },
    { symbol: 'XOM', name: 'Exxon Mobil Corp. (CEDEAR)' },
    { symbol: 'BABA', name: 'Alibaba Group (CEDEAR)' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc. (CEDEAR)' },
    { symbol: 'INTC', name: 'Intel Corp. (CEDEAR)' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc. (CEDEAR)' },
    { symbol: 'WMT', name: 'Walmart Inc. (CEDEAR)' },
    { symbol: 'PFE', name: 'Pfizer Inc. (CEDEAR)' },
    { symbol: 'JNJ', name: 'Johnson & Johnson (CEDEAR)' },
    { symbol: 'GE', name: 'General Electric Co. (CEDEAR)' },
    { symbol: 'F', name: 'Ford Motor Co. (CEDEAR)' },
    { symbol: 'GM', name: 'General Motors Co. (CEDEAR)' },
    { symbol: 'T', name: 'AT&T Inc. (CEDEAR)' },
    { symbol: 'VZ', name: 'Verizon Communications Inc. (CEDEAR)' },
    { symbol: 'HD', name: 'Home Depot Inc. (CEDEAR)' },
    { symbol: 'QCOM', name: 'Qualcomm Inc. (CEDEAR)' },
    { symbol: 'SBUX', name: 'Starbucks Corp. (CEDEAR)' },
    { symbol: 'NKE', name: 'Nike Inc. (CEDEAR)' },
    { symbol: 'GOLD', name: 'Barrick Gold Corp. (CEDEAR)' },
    { symbol: 'VALE', name: 'Vale S.A. (CEDEAR)' },
    { symbol: 'BA', name: 'Boeing Co. (CEDEAR)' },
    { symbol: 'UBER', name: 'Uber Technologies Inc. (CEDEAR)' },
    { symbol: 'COIN', name: 'Coinbase Global Inc. (CEDEAR)' },
    { symbol: 'PEP', name: 'PepsiCo Inc. (CEDEAR)' },
  ],
  CRYPTO: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'USDT-USD', name: 'Tether' },
    { symbol: 'BNB-USD', name: 'BNB' },
    { symbol: 'SOL-USD', name: 'Solana' },
    { symbol: 'USDC-USD', name: 'USD Coin' },
    { symbol: 'XRP-USD', name: 'XRP' },
    { symbol: 'DOGE-USD', name: 'Dogecoin' },
    { symbol: 'ADA-USD', name: 'Cardano' },
    { symbol: 'TRX-USD', name: 'TRON' },
    { symbol: 'AVAX-USD', name: 'Avalanche' },
    { symbol: 'LINK-USD', name: 'Chainlink' },
    { symbol: 'DOT-USD', name: 'Polkadot' },
    { symbol: 'MATIC-USD', name: 'Polygon' },
    { symbol: 'LTC-USD', name: 'Litecoin' },
    { symbol: 'SHIB-USD', name: 'Shiba Inu' },
    { symbol: 'BCH-USD', name: 'Bitcoin Cash' },
    { symbol: 'UNI-USD', name: 'Uniswap' },
    { symbol: 'ATOM-USD', name: 'Cosmos' },
    { symbol: 'XLM-USD', name: 'Stellar' },
  ],
}

// Matches on symbol OR name (company/coin name), tokenized so a multi-word
// query like "apple inc" or, for crypto, "coin" (as in "USD Coin") matches
// regardless of which field the words land in. Exact/prefix symbol matches
// rank above name matches so typing a real ticker still surfaces it first.
export function searchTickers(market: Market, query: string, limit = 8): TickerOption[] {
  const list = TICKERS[market]
  const trimmed = query.trim()
  if (!trimmed) return list.slice(0, limit)

  const q = trimmed.toUpperCase()
  const tokens = q.split(/\s+/).filter(Boolean)

  function rank(option: TickerOption): number {
    const symbol = option.symbol.toUpperCase()
    const name = option.name.toUpperCase()
    if (symbol === q) return 0
    if (symbol.startsWith(q)) return 1
    if (name.startsWith(q)) return 2
    if (name.split(/\s+/).some((word) => word.startsWith(q))) return 3
    return 4
  }

  return list
    .filter((option) => {
      const haystack = `${option.symbol} ${option.name}`.toUpperCase()
      return tokens.every((token) => haystack.includes(token))
    })
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit)
}
