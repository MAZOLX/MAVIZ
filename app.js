 // DOM Elements
const metamaskBtn = document.getElementById('metamask-btn');
const walletStatus = document.getElementById('wallet-status');
const purchaseSection = document.getElementById('purchase-section');

// State
let provider, userAddress;

// Initialize
checkWalletConnection();

// MetaMask Connection with proper handling
metamaskBtn.addEventListener('click', async () => {
  if (isMobile()) {
    // Enhanced mobile deep linking
    const cleanUrl = window.location.href.replace(/^https?:\/\//, '');
    const deeplink = `https://metamask.app.link/dapp/${cleanUrl}`;
    
    // Open MetaMask app
    window.location.href = deeplink;
    
    // Fallback if app not installed
    setTimeout(() => {
      if (!window.ethereum || !window.ethereum.isMetaMask) {
        window.open("https://metamask.io/download.html", "_blank");
      }
    }, 1000);
  } else {
    // Desktop flow
    if (!window.ethereum) {
      window.open("https://metamask.io/download.html", "_blank");
      return;
    }

    try {
      metamaskBtn.disabled = true;
      
      // This will trigger the account selection prompt
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length === 0) {
        throw new Error("No accounts selected");
      }
      
      userAddress = accounts[0];
      provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Set up listeners for account/chain changes
      window.ethereum.on('accountsChanged', (newAccounts) => {
        if (newAccounts.length > 0) {
          userAddress = newAccounts[0];
          updateUI();
        } else {
          handleDisconnect();
        }
      });
      
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
      
      updateUI();
      initMLM();
      
    } catch (error) {
      walletStatus.textContent = `Connection failed: ${error.message}`;
    } finally {
      metamaskBtn.disabled = false;
    }
  }
});

// Proper initialization after connection
function initMLM() {
  purchaseSection.style.display = 'block';
  
  // Your existing MLM initialization code
  document.getElementById('buy-btn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('amount').value);
    if (amount < 2000) {
      alert('Minimum purchase is ₦2000');
      return;
    }
    
    const slots = Math.floor(amount / 2000);
    const remainder = amount % 2000;
    
    alert(`Ready to purchase ${slots} MLM slots (₦${slots * 2000}) + ₦${remainder} MVZx tokens`);
    
    // Here you would integrate Flutterwave payment
    // initializePayment(amount, slots, remainder);
  });
}

// Helper Functions
function updateUI() {
  if (userAddress) {
    walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`;
    walletStatus.className = 'connected';
    purchaseSection.style.display = 'block';
  } else {
    walletStatus.textContent = 'Wallet not connected';
    walletStatus.className = '';
    purchaseSection.style.display = 'none';
  }
}

function checkWalletConnection() {
  if (window.ethereum?.selectedAddress) {
    userAddress = window.ethereum.selectedAddress;
    provider = new ethers.providers.Web3Provider(window.ethereum);
    updateUI();
    initMLM();
  }
}

function handleDisconnect() {
  userAddress = null;
  provider = null;
  updateUI();
}

function shortenAddress(address) {
  return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
