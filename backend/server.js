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
  max: 100
}));

// BSC Configuration
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Token Contracts
const mvzxContract = new ethers.Contract(
  process.env.MVZX_CONTRACT,
  ['function transfer(address to, uint256 amount)'],
  adminWallet
);

// MLM Storage (in production, use a database)
const mlmRegistrations = [];

// Routes
app.post('/api/register-mlm', async (req, res) => {
  try {
    const { walletAddress, name, email, phone, amount, slots, paymentMethod } = req.body;
    
    // Validate input
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    if (amount < process.env.MIN_INVESTMENT) {
      return res.status(400).json({ error: `Minimum investment is ₦${process.env.MIN_INVESTMENT}` });
    }

    // Register in MLM system
    const matrixPosition = generateMatrixPosition(walletAddress);
    const registration = {
      walletAddress,
      name,
      email,
      phone,
      amount,
      slots,
      paymentMethod,
      matrixPosition,
      date: new Date()
    };
    
    mlmRegistrations.push(registration);
    
    // Distribute tokens if paid with USDT
    if (paymentMethod === 'usdt') {
      const tokens = slots * process.env.TOKENS_PER_SLOT;
      const tx = await mvzxContract.transfer(
        walletAddress,
        ethers.utils.parseUnits(tokens.toString(), 18)
      );
      registration.txHash = tx.hash;
    }
    
    res.json({ 
      success: true,
      registration
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flutterwave Webhook
app.post('/api/flutterwave-webhook', (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];
  
  if (!signature || signature !== secretHash) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;
  
  if (payload.status === 'successful') {
    // Process successful payment
    console.log('Flutterwave payment succeeded:', payload);
    res.status(200).send('Webhook received');
  } else {
    res.status(400).json({ error: 'Payment not successful' });
  }
});

// Helper Functions
function generateMatrixPosition(walletAddress) {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(walletAddress + Date.now()));
  const level = String.fromCharCode(65 + (parseInt(hash[2], 16) % 5)); // A-E
  const position = (parseInt(hash[3], 16) % 12) + 1; // 1-12
  return `${level}${position}`;
}

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ MLM Server running on port ${PORT}`);
});
