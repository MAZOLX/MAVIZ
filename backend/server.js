 require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Token Contract
const mvzxContract = new ethers.Contract(
  process.env.MVZX_CONTRACT,
  ['function transfer(address to, uint256 amount)'],
  adminWallet
);

// Routes
app.post('/api/purchase/usdt', async (req, res) => {
  try {
    const { userAddress, amount } = req.body;
    const tokens = (amount / 0.15).toString(); // 0.15 USDT per 1 MVZx
    
    const tx = await mvzxContract.transfer(
      userAddress,
      ethers.utils.parseUnits(tokens, 18)
    );
    
    res.json({
      success: true,
      tokens,
      txHash: tx.hash
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
