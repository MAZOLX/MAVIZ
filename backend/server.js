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

const usdtContract = new ethers.Contract(
  process.env.USDT_CONTRACT,
  ['function transferFrom(address sender, address recipient, uint256 amount)'],
  adminWallet
);

// Routes
app.post('/api/purchase/ngn', async (req, res) => {
  try {
    const { walletAddress, amount } = req.body;
    const slots = Math.floor(amount / process.env.SLOT_PRICE_NGN);
    const tokens = slots * process.env.TOKENS_PER_SLOT;
    
    const tx = await mvzxContract.transfer(
      walletAddress,
      ethers.utils.parseUnits(tokens.toString(), 18)
    );
    
    res.json({
      success: true,
      slots,
      tokens,
      txHash: tx.hash
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchase/usdt', async (req, res) => {
  try {
    const { walletAddress, amount } = req.body;
    const slots = Math.floor(amount / process.env.SLOT_PRICE_USDT);
    
    // Transfer USDT
    const usdtTx = await usdtContract.transferFrom(
      walletAddress,
      process.env.TREASURY_WALLET,
      ethers.utils.parseUnits(amount.toString(), 18)
    );
    
    // Transfer MVZX
    const mvzxTx = await mvzxContract.transfer(
      walletAddress,
      ethers.utils.parseUnits(
        (slots * process.env.TOKENS_PER_SLOT).toString(), 
        18
      )
    );
    
    res.json({
      success: true,
      slots,
      usdtTx: usdtTx.hash,
      mvzxTx: mvzxTx.hash
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
