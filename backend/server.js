require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT) || 100
}));

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

// MLM Purchase Endpoint
app.post('/api/purchase', async (req, res) => {
  try {
    const { walletAddress, amount, slots, remainder, referralCode } = req.body;

    // Validation
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (amount < parseInt(process.env.SLOT_COST_NGN)) {
      return res.status(400).json({ 
        error: `Minimum purchase is ₦${process.env.SLOT_COST_NGN}` 
      });
    }

    // Calculate matrix position (simplified example)
    const matrixPosition = calculateMatrixPosition(walletAddress, slots);

    // Calculate token amounts (example conversion)
    const tokenAmount = Math.floor(
      (amount * process.env.MVZX_USDT_RATE) * 1e18
    );

    // In production:
    // 1. Record purchase in database
    // 2. Process MLM referrals
    // 3. Transfer tokens

    res.json({ 
      success: true,
      matrixPosition,
      slots,
      tokenAmount: tokenAmount.toString(),
      message: "Purchase registered successfully"
    });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate matrix position
function calculateMatrixPosition(walletAddress, slots) {
  // Simplified example - replace with your MLM algorithm
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(walletAddress + Date.now()));
  const level = String.fromCharCode(65 + (parseInt(hash[2], 16) % 5); // A-E
  const position = (parseInt(hash[3], 16) % 2 + 1; // 1-2
  return `${level}${position}-${slots}`;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ MLM backend running on port ${PORT}`);
});
