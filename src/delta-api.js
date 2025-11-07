import axios from 'axios';
import CryptoJS from 'crypto-js';

const BASE_URL = 'https://api.india.delta.exchange';

export class DeltaExchangeAPI {
  constructor(apiKey, apiSecret) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key format. Please check your Delta Exchange API credentials.');
    }
    if (!apiSecret || typeof apiSecret !== 'string') {
      throw new Error('Invalid API secret format. Please check your Delta Exchange API credentials.');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  generateSignature(secret, message) {
    // Using CryptoJS instead of node's crypto (for browser compatibility)
    return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Hex);
  }

  async makeRequest(method, endpoint, data = null) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = `/v2${endpoint}`;

    // Build sorted query string for signing (stable order)
    let queryString = '';
    if (data && Object.keys(data).length > 0) {
      const sorted = Object.keys(data).sort().map((k) => [k, data[k]]);
      queryString = '?' + sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    }

    const payload = '';

    // Exactly matching the example: method + timestamp + path + queryString + payload
    const signatureData = method + timestamp + path + queryString + payload;
    const signature = this.generateSignature(this.apiSecret, signatureData);

    // Build final URL including query string so axios doesn't re-encode params differently
    const fullUrl = `${BASE_URL}${path}${queryString}`;

    console.debug('[DeltaAPI] Request details:', {
      method,
      path,
      timestamp,
      signatureData,
      fullUrlPreview: `${BASE_URL}${path}${queryString.substring(0, 80)}${queryString.length > 80 ? '...': ''}`
    });


    

    try {
      const headers = {
        'api-key': this.apiKey,
        'timestamp': timestamp,
        'signature': signature,
        'Content-Type': 'application/json',
        'User-Agent': 'js-rest-client'
      };

      console.debug('[DeltaAPI] Making request:', {
        url: fullUrl,
        headers: {
          'api-key': '(hidden)',
          'timestamp': headers.timestamp,
          'signature': headers.signature
        }
      });

      // Use the fully-built URL so the exact same query string is sent as was signed
      const response = await axios.get(fullUrl, { headers });
      return response.data;
    } catch (error) {
      // If signature expired, Delta often returns server_time in seconds
      const resp = error.response?.data;
      if (resp && resp.error && resp.error.code === 'expired_signature' && resp.error.context && resp.error.context.server_time) {
        try {
          const serverTimeSec = resp.error.context.server_time;
          const adjustedTimestamp = String(serverTimeSec); // server_time is in seconds

          // Recompute signature with adjusted timestamp (seconds)
          const retrySignature = this.generateSignature(this.apiSecret, method + adjustedTimestamp + path + queryString + payload);
          console.warn('[DeltaAPI] expired_signature received, retrying with server time (seconds)', { serverTimeSec });

          const retryFullUrl = `${BASE_URL}${path}${queryString}`;
          const retryResp = await axios.get(retryFullUrl, {
            headers: {
              'api-key': this.apiKey,
              'timestamp': adjustedTimestamp,
              'signature': retrySignature,
              'Content-Type': 'application/json',
              'User-Agent': 'js-rest-client'
            }
          });

          return retryResp.data;
        } catch (retryError) {
          // Fall through to throw original or retry error
          throw new Error(`Delta Exchange API Error (retry): ${retryError.response?.data?.message || retryError.message}`);
        }
      }

      throw new Error(`Delta Exchange API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  async getFills() {
    // Fetch all fills using pagination (Delta returns `meta.after` for pagination)
    const endpoint = '/fills';
    const all = [];
    let params = { limit: 100 };

    while (true) {
      const resp = await this.makeRequest('GET', endpoint, params);
      // Delta response format: { success: true, result: [...], meta: { after } }
      console.debug('[DeltaAPI] Got fills response:', {
        success: resp?.success,
        resultCount: Array.isArray(resp?.result) ? resp.result.length : 'not array',
        hasAfter: Boolean(resp?.meta?.after)
      });

      if (resp?.success && Array.isArray(resp.result)) {
        all.push(...resp.result);
        console.debug(`[DeltaAPI] Added ${resp.result.length} fills, total: ${all.length}`);
      } else {
        console.warn('[DeltaAPI] Unexpected response format:', resp);
      }

      const after = resp?.meta?.after;
      if (!after) break;
      params.after = after;
    }

    return all;
  }

  // Convert Delta Exchange trade format to our app's format
  convertTradeFormat(fill) {
  const direction = (fill.side || '').toLowerCase();
  const size = Math.abs(parseFloat(fill.size || 0));
  const price = parseFloat(fill.price || 0);
      const commission = parseFloat(fill.commission || 0);
      const notional = parseFloat(fill.notional || 0);
    
      // Extract position data if available
      const position = fill.meta_data?.new_position || {};
      const pnl = parseFloat(position.realized_pnl || 0);
      const liquidationPrice = parseFloat(position.liquidation_price || 0);
    
      // Map fills to a single-record ledger entry. NOTE: fills are executions; to create
      // paired entry/exit trades we would need to group by order/position. Here we store
      // each fill as a single journal row. To avoid showing identical entry & exit
      // prices (which confused users), set entry for buy fills and exit for sell fills.
      return {
        // Basic trade info
        date: new Date(fill.created_at).toISOString(),
        instrument: fill.product_symbol,
        direction,
        strategy: ['delta-sync'], // Tag synced trades
        entry: direction === 'buy' ? price : null,
        exit: direction === 'sell' ? price : null,
        stopLoss: liquidationPrice || 0,
        takeProfit: 0,
        size,
      
        // Enhanced PnL and risk metrics
        pnl,
        commission,
        notional,
        effectiveCommissionRate: parseFloat(fill.meta_data?.effective_commission_rate || 0),
        riskAmount: parseFloat(position.margin || 0),
        riskRewardRatio: 0,
        rMultiple: pnl > 0 ? Math.abs(pnl / parseFloat(position.margin || 1)) : -Math.abs(pnl / parseFloat(position.margin || 1)),

        // Trade metadata
        tags: [
          'delta-exchange',
          fill.role, // 'maker' or 'taker'
          fill.fill_type,
          fill.meta_data?.order_type?.replace('_', '-') || 'unknown'
        ].filter(Boolean),
      
        // Additional Delta-specific data
        deltaMetadata: {
          orderId: fill.order_id,
          tradeId: fill.id,
          fillType: fill.fill_type,
          role: fill.role,
          settlingAsset: fill.settling_asset_symbol,
          orderType: fill.meta_data?.order_type,
          markPrice: parseFloat(fill.meta_data?.mark || 0),
          spotPrice: parseFloat(fill.meta_data?.spot || 0),
          source: fill.meta_data?.source || 'unknown'
        },
      
        psychology: null,
        remarks: `Trade synced from Delta Exchange
  Order ID: ${fill.order_id}
  Trade ID: ${fill.id}
  Type: ${fill.role} (${fill.meta_data?.order_type || 'unknown'})
  Commission: ${commission} ${fill.settling_asset_symbol}
  Notional: ${notional} ${fill.settling_asset_symbol}
  Mark Price: ${fill.meta_data?.mark}
  Spot Price: ${fill.meta_data?.spot}
  Source: ${fill.meta_data?.source || 'unknown'}`,
      
        rulesCompliance: 100, // Auto-approve synced trades
        rulesChecked: {},
        screenshots: [],
        timestamp: new Date(fill.created_at).getTime()
      };
  }
}