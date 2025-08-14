require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// BSC Configuration
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Token Contracts
const mvzxContract = new ethers.Contract(
  process.env.MVZX_CONTRACT,
  [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)'
  ],
  adminWallet
);

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT,
  [
    'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)'
  ],
  adminWallet
);

// MLM Storage (In production, use a database)
const mlmMembers = new Map();
const platformWallets = new Map();

// Routes

// 1. Wallet Management
app.post('/api/wallet/create', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Generate deterministic platform wallet
    const seed = ethers.utils.id(userId + Date.now());
    const wallet = ethers.Wallet.createRandom({
      extraEntropy: seed
    }).then(newWallet => {
      const walletData = {
        address: newWallet.address,
        privateKey: newWallet.privateKey,
        userId,
        createdAt: new Date()
      };

      platformWallets.set(userId, walletData);
      return walletData;
    });

    res.json({
      success: true,
      wallet: wallet.address
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Process USDT Purchase
app.post('/api/purchase/usdt', async (req, res) => {
  try {
    const { userWallet, platformWallet, amount, userId } = req.body;
    
    // Validate inputs
    if (!ethers.utils.isAddress(userWallet) || !ethers.utils.isAddress(platformWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (amount < process.env.MIN_PURCHASE_USDT) {
      return res.status(400).json({ error: `Minimum purchase is $${process.env.MIN_PURCHASE_USDT}` });
    }

    // Check USDT allowance
    const allowance = await usdtContract.allowance(userWallet, adminWallet.address);
    const requiredAmount = ethers.utils.parseUnits(amount.toString(), 18);
    
    if (allowance.lt(requiredAmount)) {
      return res.status(400).json({ error: 'Insufficient USDT allowance' });
    }

    // Transfer USDT to treasury
    const usdtTx = await usdtContract.transferFrom(
      userWallet,
      process.env.TREASURY_WALLET,
      requiredAmount
    );

    // Calculate and transfer MVZx tokens
    const tokensPerSlot = ethers.utils.parseUnits(process.env.TOKENS_PER_SLOT, 18);
    const slots = Math.floor(amount / process.env.SLOT_PRICE_USDT);
    const tokens = tokensPerSlot.mul(slots);

    const mvzxTx = await mvzxContract.transfer(platformWallet, tokens);

    // Register in MLM
    const matrixPosition = generateMatrixPosition(platformWallet, slots);
    registerMlmMember(userId, platformWallet, amount, slots, 'usdt');

    res.json({
      success: true,
      slots,
      tokens: tokens.toString(),
      matrixPosition,
      usdtTx: usdtTx.hash,
      mvzxTx: mvzxTx.hash
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.reason || 'Transaction failed'
    });
  }
});

// 3. Process Cash Purchase (Flutterwave Webhook)
app.post('/api/purchase/cash', async (req, res) => {
  try {
    const { platformWallet, amount, paymentRef, userId } = req.body;
    
    if (!ethers.utils.isAddress(platformWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (amount < process.env.MIN_PURCHASE_NGN) {
      return res.status(400).json({ error: `Minimum purchase is ₦${process.env.MIN_PURCHASE_NGN}` });
    }

    // Calculate and transfer MVZx tokens
    const tokensPerSlot = ethers.utils.parseUnits(process.env.TOKENS_PER_SLOT, 18);
    const slots = Math.floor(amount / process.env.SLOT_PRICE_NGN);
    const tokens = tokensPerSlot.mul(slots);

    const tx = await mvzxContract.transfer(platformWallet, tokens);

    // Register in MLM
    const matrixPosition = generateMatrixPosition(platformWallet, slots);
    registerMlmMember(userId, platformWallet, amount, slots, 'cash', paymentRef);

    res.json({
      success: true,
      slots,
      tokens: tokens.toString(),
      matrixPosition,
      txHash: tx.hash
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.reason || 'Transaction failed'
    });
  }
});

// 4. Flutterwave Webhook
app.post('/api/flutterwave/webhook', (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];
  
  if (!signature || signature !== secretHash) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;
  
  if (payload.status === 'successful') {
    // Process successful payment
    console.log('Flutterwave payment succeeded:', payload);
    
    // In production: Call /api/purchase/cash with the payment details
    res.status(200).send('Webhook received');
  } else {
    res.status(400).json({ error: 'Payment not successful' });
  }
});

// Helper Functions
function generateMatrixPosition(walletAddress, slots) {
  const hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256'],
      [walletAddress, Date.now()]
    )
  );
  const level = String.fromCharCode(65 + (parseInt(hash[2], 16) % 5)); // A-E
  const position = (parseInt(hash[3], 16) % 12) + 1; // 1-12
  return `${level}${position}-${slots}`;
}

function registerMlmMember(userId, walletAddress, amount, slots, paymentMethod, paymentRef = null) {
  const member = {
    userId,
    walletAddress,
    amount,
    slots,
    paymentMethod,
    paymentRef,
    joinDate: new Date(),
    matrixPosition: generateMatrixPosition(walletAddress, slots),
    referrals: []
  };

  mlmMembers.set(userId, member);
  return member;
}

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ MLM Backend running on port ${PORT}`);
});
