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
  process.env.MVZX_TOKEN_CONTRACT,
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

// API Endpoints

// 1. Verify Wallet & Signature
app.post('/api/verify-wallet', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Verify signature against our verification message
    const message = 'MAVIZ_WALLET_VERIFICATION_' + Date.now();
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check BNB chain
    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      return res.status(400).json({ 
        error: 'Wrong network',
        requiredChainId: 56,
        currentChainId: network.chainId 
      });
    }

    res.json({ 
      verified: true,
      wallet: walletAddress,
      message: 'Verification successful'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Process Naira Purchase (Flutterwave Webhook)
app.post('/api/purchase/ngn', async (req, res) => {
  try {
    const { walletAddress, amount, transactionId } = req.body;
    
    // Validate input
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (amount < process.env.MIN_PURCHASE_NGN) {
      return res.status(400).json({ 
        error: `Minimum purchase is ₦${process.env.MIN_PURCHASE_NGN}` 
      });
    }

    // Calculate slots and tokens
    const slots = Math.floor(amount / process.env.SLOT_PRICE_NGN);
    const tokensPerSlot = ethers.utils.parseUnits(process.env.TOKENS_PER_SLOT, 18);
    const totalTokens = tokensPerSlot.mul(slots);

    // Verify token balance
    const contractBalance = await mvzxContract.balanceOf(adminWallet.address);
    if (contractBalance.lt(totalTokens)) {
      return res.status(400).json({ error: 'Insufficient contract balance' });
    }

    // Transfer tokens
    const tx = await mvzxContract.transfer(walletAddress, totalTokens);
    await tx.wait();

    // Register in MLM system
    const matrixPosition = generateMatrixPosition(walletAddress, slots);

    res.json({
      success: true,
      slots,
      tokens: totalTokens.toString(),
      matrixPosition,
      transactionId,
      txHash: tx.hash
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.reason || 'Transaction failed' 
    });
  }
});

// 3. Process USDT Purchase
app.post('/api/purchase/usdt', async (req, res) => {
  try {
    const { walletAddress, amount } = req.body;
    
    // Validate
    if (!ethers.utils.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Check allowance
    const allowance = await usdtContract.allowance(
      walletAddress,
      adminWallet.address
    );
    
    const requiredAmount = ethers.utils.parseUnits(amount.toString(), 18);
    if (allowance.lt(requiredAmount)) {
      return res.status(400).json({ error: 'Insufficient USDT allowance' });
    }

    // Calculate slots
    const slotPriceUSDT = ethers.utils.parseUnits(
      process.env.SLOT_PRICE_USDT.toString(), 
      18
    );
    const slots = requiredAmount.div(slotPriceUSDT);

    // Transfer USDT
    const tx = await usdtContract.transferFrom(
      walletAddress,
      process.env.TREASURY_WALLET,
      requiredAmount
    );
    await tx.wait();

    // Distribute MVZx tokens
    const tokensPerSlot = ethers.utils.parseUnits(process.env.TOKENS_PER_SLOT, 18);
    const tokenTx = await mvzxContract.transfer(
      walletAddress,
      tokensPerSlot.mul(slots)
    );
    await tokenTx.wait();

    // Register in MLM
    const matrixPosition = generateMatrixPosition(walletAddress, slots.toNumber());

    res.json({
      success: true,
      slots: slots.toNumber(),
      usdtAmount: amount,
      matrixPosition,
      txHash: tx.hash,
      tokenTxHash: tokenTx.hash
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.reason || 'Transaction failed'
    });
  }
});

// 4. Flutterwave Webhook
app.post('/api/flutterwave/webhook', async (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];
  
  if (!signature || signature !== secretHash) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tx_ref, status, amount, customer } = req.body;
  
  if (status !== 'successful') {
    return res.status(400).json({ error: 'Payment not successful' });
  }

  // Process payment (would link to your purchase/ngn endpoint)
  res.status(200).json({ received: true });
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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MAVIZ Backend running on port ${PORT}`);
});
