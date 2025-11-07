// Currency conversion rates (can be made dynamic with API later)
const USD_TO_INR = 83.27; // Example rate, should be updated regularly

// Utility function to format currency values consistently across the app
export function formatCurrency(value, currency = 'USD', options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 6, // Higher precision for crypto
    notation = 'standard',
    convertToINR = true
  } = options;

  if (value == null) return '-';

  // Convert to INR if requested
  let finalValue = value;
  let finalCurrency = currency;
  if (convertToINR && (currency === 'USD' || currency === 'USDT')) {
    finalValue = value * USD_TO_INR;
    finalCurrency = 'INR';
  }

  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits,
      maximumFractionDigits,
      notation
    }).format(finalValue);
    
    // For non-INR values, append the original currency
    if (finalCurrency !== 'INR') {
      return `${formatted} ${finalCurrency}`;
    }
    return formatted;
  } catch (e) {
    return `${finalValue} ${finalCurrency}`;
  }
}

// Get the settling currency from a trade
export function getTradeCurrency(trade) {
  return trade?.deltaMetadata?.settlingAsset || 'USD';
}

// Get the most common currency from a list of trades
export function getCommonCurrency(trades = []) {
  if (!trades.length) return 'USD';
  
  // Count currencies
  const currencyCount = trades.reduce((count, trade) => {
    const currency = getTradeCurrency(trade);
    count[currency] = (count[currency] || 0) + 1;
    return count;
  }, {});

  // Find most frequent
  return Object.entries(currencyCount)
    .sort(([,a], [,b]) => b - a)[0][0];
}