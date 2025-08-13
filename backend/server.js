require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.API_RATE_LIMIT || 100
});
app.use(limiter);

// Blockchain setup
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Token contracts
const mvzxContract = new ethers.Contract(
  process.env.MVZX_TOKEN_CONTRACT,
  ['function transfer(address to, uint256 amount) returns (bool)'],
  adminWallet
);

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT,
  ['function transfer(address to, uint256 amount) returns (bool)'],
  adminWallet
);

// MLM endpoints
app.post('/api/purchase', async (req, res) => {
  try {
    const { walletAddress, amount, slots, remainder, referralCode } = req.body;
    
    // Validate input
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    if (amount < process.env.SLOT_COST_NGN) {
      return res.status(400).json({ 
        error: `Minimum purchase is ₦${process.env.SLOT_COST_NGN}` 
      });
    }
    
    // Process MLM matrix placement (simplified)
    const matrixPosition = calculateMatrixPosition(walletAddress);
    
    // Calculate token amounts
    const slotValueUSDT = (process.env.SLOT_COST_NGN / process.env.MVZX_USDT_RATE) * 1e18;
    const remainderValueUSDT = (remainder / process.env.MVZX_USDT_RATE) * 1e18;
    
    // In production, you would:
    // 1. Record the purchase in your MLM system
    // 2. Process referrals
    // 3. Credit tokens
    
    res.json({ 
      success: true,
      matrixPosition,
      slots,
      remainder,
      tokensToCredit: remainderValueUSDT.toString()
    });
    
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate matrix position
function calculateMatrixPosition(walletAddress) {
  // Simplified - in reality you'd use your MLM algorithm
  const levels = ['A', 'B', 'C', 'D', 'E'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const position = Math.floor(Math.random() * 2) + 1;
  return `${level}${position}`;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ MLM backend running on port ${PORT}`);
});
