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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100
}));

// BSC Configuration
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Token Contracts
const mvzxContract = new ethers.Contract(
  process.env.MVZX_TOKEN_CONTRACT,
  ['function transfer(address to, uint256 amount) returns (bool)'],
  adminWallet
);

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT,
  ['function transferFrom(address sender, address recipient, uint256 amount) returns (bool)'],
  adminWallet
);

// API Endpoints

// 1. Verify Wallet Connection
app.post('/api/verify-wallet', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Verify signature (simplified example)
    const recoveredAddress = ethers.utils.verifyMessage('MAVIZ_WALLET_VERIFICATION', signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    res.json({ 
      verified: true,
      wallet: walletAddress
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Process Naira Purchase
app.post('/api/purchase/ngn', async (req, res) => {
  try {
    const { walletAddress, amount, txHash } = req.body;
    
    // Validate input
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (amount < process.env.SLOT_COST_NGN) {
      return res.status(400).json({ error: `Minimum purchase is ₦${process.env.SLOT_COST_NGN}` });
    }

    // Calculate slots and tokens
    const slots = Math.floor(amount / process.env.SLOT_COST_NGN);
    const remainder = amount % process.env.SLOT_COST_NGN;
    const tokens = (remainder * process.env.MVZX_USDT_RATE) * 1e18;

    // Register in MLM system (simplified)
    const matrixPosition = generateMatrixPosition(walletAddress, slots);

    // Credit tokens
    const tx = await mvzxContract.transfer(walletAddress, tokens.toString());

    res.json({
      success: true,
      slots,
      tokens: tokens.toString(),
      matrixPosition,
      txHash: tx.hash
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Process USDT Purchase
app.post('/api/purchase/usdt', async (req, res) => {
  try {
    const { walletAddress, amount, approvalTx } = req.body;
    
    // Validate
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Calculate slots
    const slotCostUSDT = process.env.SLOT_COST_NGN / process.env.MVZX_USDT_RATE;
    const slots = Math.floor(amount / slotCostUSDT);

    // Process USDT transfer
    const tx = await usdtContract.transferFrom(
      walletAddress,
      process.env.COMPANY_WALLET,
      (amount * 1e18).toString()
    );

    // Register in MLM
    const matrixPosition = generateMatrixPosition(walletAddress, slots);

    res.json({
      success: true,
      slots,
      usdtAmount: amount,
      matrixPosition,
      txHash: tx.hash
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper Functions
function generateMatrixPosition(walletAddress, slots) {
  // This is a simplified example - replace with your MLM algorithm
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(walletAddress + Date.now()));
  const level = String.fromCharCode(65 + (parseInt(hash[2], 16) % 5)); // A-E
  const position = (parseInt(hash[3], 16) % 2) + 1; // 1-2
  return `${level}${position}-${slots}`;
}

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ Backend running on port ${PORT}`);
});
