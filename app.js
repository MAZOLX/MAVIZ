// MAVIZ Token Purchase Platform
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const metamaskBtn = document.getElementById('metamask-btn');
  const walletconnectBtn = document.getElementById('walletconnect-btn');
  const buyCashBtn = document.getElementById('buy-cash-btn');
  const usdtPurchaseSection = document.getElementById('usdt-purchase');
  const walletAddressSpan = document.getElementById('wallet-address');
  const usdtAmountInput = document.getElementById('usdt-amount');
  const usdtSummary = document.getElementById('usdt-summary');
  const confirmUsdtBtn = document.getElementById('confirm-usdt-btn');
  const loadingDiv = document.getElementById('loading');
  const errorDisplay = document.getElementById('error-display');

  // Constants
  const SLOT_PRICE_USDT = 3.33;
  const SLOT_PRICE_NGN = 2000;
  const BNB_CHAIN_ID = '0x38'; // Binance Smart Chain
  let userAddress = null;
  let provider = null;

  // Initialize
  checkPersistedWallet();

  // Event Listeners
  metamaskBtn.addEventListener('click', connectMetaMask);
  walletconnectBtn.addEventListener('click', connectWalletConnect);
  buyCashBtn.addEventListener('click', initiateCashPurchase);
  usdtAmountInput.addEventListener('input', updateUsdtSummary);
  confirmUsdtBtn.addEventListener('click', processUsdtPurchase);

  // 1. MetaMask Connection
  async function connectMetaMask() {
    showLoading();
    
    try {
      if (!window.ethereum) {
        if (isMobile()) {
          // Mobile deep link
          const cleanUrl = window.location.href.replace(/^https?:\/\//, '');
          window.location.href = `https://metamask.app.link/dapp/${cleanUrl}`;
          
          // Check for connection every second
          const checkInterval = setInterval(() => {
            if (window.ethereum?.selectedAddress) {
              clearInterval(checkInterval);
              handleWalletConnection();
            }
          }, 1000);
          
          setTimeout(() => clearInterval(checkInterval), 10000);
          return;
        } else {
          window.open('https://metamask.io/download.html', '_blank');
          throw new Error('MetaMask not installed');
        }
      }

      // Switch to BSC network
      await switchToBNBChain();
      
      // Request accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        userAddress = accounts[0];
        handleSuccessfulConnection();
      }
    } catch (error) {
      showError(`MetaMask connection failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // 2. WalletConnect Connection
  async function connectWalletConnect() {
    showLoading();
    
    try {
      const walletConnectProvider = new WalletConnectProvider.default({
        rpc: {
          56: "https://bsc-dataseed.binance.org/" // BSC RPC
        },
        chainId: 56
      });

      await walletConnectProvider.enable();
      provider = new ethers.providers.Web3Provider(walletConnectProvider);
      userAddress = await provider.getSigner().getAddress();
      
      handleSuccessfulConnection();
    } catch (error) {
      showError(`WalletConnect failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // 3. Cash Purchase via Flutterwave
  function initiateCashPurchase() {
    try {
      FlutterwaveCheckout({
        public_key: process.env.FLUTTERWAVE_PUBLIC_KEY, // Will be replaced by Vercel
        tx_ref: 'MVZX-' + Date.now(),
        amount: SLOT_PRICE_NGN,
        currency: "NGN",
        payment_options: "card, banktransfer, ussd",
        customer: {
          email: "customer@maviz.com",
          phone_number: "2348012345678",
          name: "MVZx Buyer"
        },
        callback: function(response) {
          if (response.status === "successful") {
            showSuccess("Payment successful! Tokens will be credited shortly.");
          } else {
            showError("Payment failed or was cancelled");
          }
        },
        customizations: {
          title: "MAVIZ Token Purchase",
          description: `Purchase MVZx Tokens (₦${SLOT_PRICE_NGN}/slot)`,
          logo: "https://i.imgur.com/VbxvCK6.jpeg"
        }
      });
    } catch (error) {
      showError(`Payment initialization failed: ${error.message}`);
    }
  }

  // 4. USDT Purchase Processing
  async function processUsdtPurchase() {
    const amount = parseFloat(usdtAmountInput.value);
    
    if (isNaN(amount) || amount < SLOT_PRICE_USDT) {
      showError(`Minimum purchase is $${SLOT_PRICE_USDT} (1 slot)`);
      return;
    }

    showLoading();
    
    try {
      // In production, implement:
      // 1. USDT contract interaction
      // 2. Backend purchase registration
      // 3. Transaction confirmation
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const slots = Math.floor(amount / SLOT_PRICE_USDT);
      showSuccess(`Success! Purchased ${slots} slot(s)`);
      usdtAmountInput.value = '';
    } catch (error) {
      showError(`Transaction failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // Helper Functions
  function handleSuccessfulConnection() {
    // Update UI
    walletAddressSpan.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
    usdtPurchaseSection.style.display = 'block';
    
    // Store connection
    localStorage.setItem('mavizConnected', 'true');
    
    // Set up listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          resetWalletConnection();
        } else {
          userAddress = accounts[0];
          walletAddressSpan.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        }
      });
      
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }

  async function switchToBNBChain() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BNB_CHAIN_ID }]
      });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BNB_CHAIN_ID,
            chainName: 'BNB Smart Chain',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18
            },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com']
          }]
        });
      }
    }
  }

  function updateUsdtSummary() {
    const amount = parseFloat(usdtAmountInput.value) || 0;
    const slots = Math.floor(amount / SLOT_PRICE_USDT);
    const remainder = amount % SLOT_PRICE_USDT;
    
    usdtSummary.innerHTML = amount >= SLOT_PRICE_USDT ? `
      <p>You will receive: <strong>${slots} slot(s)</strong></p>
      ${remainder > 0 ? `<p>Remaining USDT: $${remainder.toFixed(2)}</p>` : ''}
    ` : '<p>Minimum purchase: $3.33 (1 slot)</p>';
  }

  function checkPersistedWallet() {
    if (localStorage.getItem('mavizConnected') && window.ethereum?.selectedAddress) {
      userAddress = window.ethereum.selectedAddress;
      provider = new ethers.providers.Web3Provider(window.ethereum);
      handleSuccessfulConnection();
    }
  }

  function resetWalletConnection() {
    userAddress = null;
    provider = null;
    localStorage.removeItem('mavizConnected');
    usdtPurchaseSection.style.display = 'none';
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function showLoading() {
    loadingDiv.style.display = 'block';
  }

  function hideLoading() {
    loadingDiv.style.display = 'none';
  }

  function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorDisplay.appendChild(errorElement);
    
    setTimeout(() => {
      errorElement.classList.add('fade-out');
      setTimeout(() => errorElement.remove(), 300);
    }, 5000);
  }

  function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'error-message';
    successElement.style.backgroundColor = 'var(--accent)';
    successElement.textContent = message;
    errorDisplay.appendChild(successElement);
    
    setTimeout(() => {
      successElement.classList.add('fade-out');
      setTimeout(() => successElement.remove(), 300);
    }, 5000);
  }

  // Handle mobile return from wallet apps
  if (isMobile()) {
    window.addEventListener('focus', () => {
      if (window.ethereum?.selectedAddress && !userAddress) {
        checkPersistedWallet();
      }
    });
  }
});
