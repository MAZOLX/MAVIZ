require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// Blockchain Setup
const provider = new ethers.providers.JsonRpcProvider(process.env.BNB_RPC_URL);
const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// Mock Purchase Endpoint
app.post('/api/purchase', async (req, res) => {
  try {
    const { amount, userAddress } = req.body;
    
    // Validate input
    if (!amount || amount < 2000) {
      return res.status(400).json({ error: "Minimum purchase is ₦2000" });
    }
    
    // Mock response
    res.json({
      success: true,
      message: `Received ₦${amount} from ${userAddress}`,
      txHash: "0x" + Math.random().toString(16).substr(2, 64) // Mock hash
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: "active",
    network: await provider.getNetwork().then(n => n.name),
    balance: await provider.getBalance(wallet.address) 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
