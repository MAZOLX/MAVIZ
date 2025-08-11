require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Path to your .env file (relative to script location)
const ENV_PATH = path.join(__dirname, '..', '.env'); 

async function updateExchangeRates() {
  try {
    // Get current rates from Binance API
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTNGN');
    const usdtToNgn = parseFloat(response.data.price).toFixed(2);

    // Read existing .env
    let envFile = fs.readFileSync(ENV_PATH, 'utf8');
    
    // Update values
    envFile = envFile.replace(
      /USDT_TO_NGN=.*/,
      `USDT_TO_NGN="${usdtToNgn}"`
    );
    envFile = envFile.replace(
      /LAST_UPDATED=.*/,
      `LAST_UPDATED="${new Date().toISOString()}"`
    );

    // Write back to .env
    fs.writeFileSync(ENV_PATH, envFile);
    
    console.log(`✅ Rates updated: 1 USDT = ₦${usdtToNgn}`);
  } catch (error) {
    console.error('❌ Rate update failed:', error.message);
  }
}

updateExchangeRates();
