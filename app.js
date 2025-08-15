document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectBtn = document.getElementById('connect-wallet-btn');
  const createBtn = document.getElementById('create-wallet-btn');
  const walletStatus = document.getElementById('wallet-status');
  const statusIndicator = walletStatus.querySelector('.status-indicator');
  const walletAddressDisplay = document.getElementById('wallet-address-display');
  const walletAddressInput = document.getElementById('wallet-address');
  const copyAddressBtn = document.getElementById('copy-address-btn');
  const paymentMethods = document.getElementById('payment-methods');
  const payWithUsdtBtn = document.getElementById('pay-with-usdt');
  const payWithCashBtn = document.getElementById('pay-with-cash');
  const usdtForm = document.getElementById('usdt-form');
  const cashForm = document.getElementById('cash-form');
  const usdtAmountInput = document.getElementById('usdt-amount');
  const usdtTokensDisplay = document.getElementById('usdt-tokens');
  const cashAmountInput = document.getElementById('cash-amount');
  const cashTokensDisplay = document.getElementById('cash-tokens');
  const confirmUsdtBtn = document.getElementById('confirm-usdt');
  const confirmCashBtn = document.getElementById('confirm-cash');
  const loadingDiv = document.getElementById('loading');

  // Constants
  const TOKEN_PRICE_USDT = 0.15; // 0.15 USDT per 1 MVZx
  const MIN_PURCHASE_USDT = 2; // 2 USDT minimum
  const NAIRA_RATE = 1000; // 1 USDT ≈ ₦1000
  let userWallet = null;
  let platformWallet = null;

  // Initialize
  checkPersistedWallet();

  // Event Listeners
  connectBtn.addEventListener('click', connectExternalWallet);
  createBtn.addEventListener('click', createPlatformWallet);
  copyAddressBtn.addEventListener('click', copyWalletAddress);
  payWithUsdtBtn.addEventListener('click', () => showPurchaseForm('usdt'));
  payWithCashBtn.addEventListener('click', () => showPurchaseForm('cash'));
  usdtAmountInput.addEventListener('input', updateUsdtTokenCalculation);
  cashAmountInput.addEventListener('input', updateCashTokenCalculation);
  confirmUsdtBtn.addEventListener('click', processUsdtPurchase);
  confirmCashBtn.addEventListener('click', processCashPurchase);

  // 1. Wallet Functions
  async function connectExternalWallet() {
    showLoading();
    
    try {
      if (!window.ethereum) {
        if (isMobile()) {
          window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
          return;
        }
        throw new Error('Please install MetaMask or another Web3 wallet');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        userWallet = accounts[0];
        
        // Create platform wallet if not exists
        if (!platformWallet) {
          platformWallet = generatePlatformWallet(userWallet);
        }
        
        updateWalletDisplay();
        persistWallet();
      }
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoading();
    }
  }

  function createPlatformWallet() {
    showLoading();
    
    try {
      if (!platformWallet) {
        const seed = window.crypto.getRandomValues(new Uint32Array(10)).join('');
        platformWallet = {
          address: ethers.utils.getAddress(`0x${ethers.utils.keccak256(ethers.utils.toUtf8Bytes(seed)).substring(0,40)}`),
          isPlatform: true
        };
        
        updateWalletDisplay();
        persistWallet();
      }
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoading();
    }
  }

  function generatePlatformWallet(externalAddress) {
    const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(externalAddress + Date.now()));
    return {
      address: ethers.utils.getAddress(`0x${seed.substring(0,40)}`),
      isPlatform: true
    };
  }

  // 2. Purchase Functions
  async function processUsdtPurchase() {
    const amount = parseFloat(usdtAmountInput.value);
    
    if (amount < MIN_PURCHASE_USDT) {
      showError(`Minimum purchase is ${MIN_PURCHASE_USDT} USDT`);
      return;
    }

    showLoading();
    
    try {
      // In production: Implement actual USDT contract call
      const tokens = amount / TOKEN_PRICE_USDT;
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccess(`Success! Purchased ${tokens.toFixed(2)} MVZx tokens`);
      resetForms();
    } catch (error) {
      showError(error.message);
    } finally {
      hideLoading();
    }
  }

  function processCashPurchase() {
    const amount = parseFloat(cashAmountInput.value);
    const minNaira = MIN_PURCHASE_USDT * NAIRA_RATE;
    
    if (amount < minNaira) {
      showError(`Minimum purchase is ₦${minNaira}`);
      return;
    }

    showLoading();
    
    try {
      const tokens = (amount / NAIRA_RATE) / TOKEN_PRICE_USDT;
      
      FlutterwaveCheckout({
        public_key: process.env.FLUTTERWAVE_PUBLIC_KEY, // From your Vercel env
        tx_ref: 'MVZX-' + Date.now(),
        amount: amount,
        currency: "NGN",
        payment_options: "card, banktransfer",
        customer: {
          email: "user@example.com", // Should collect in production
          phone_number: "2348012345678",
          name: "MVZx Buyer"
        },
        callback: function(response) {
          if (response.status === "successful") {
            showSuccess(`Payment successful! ${tokens.toFixed(2)} MVZx tokens purchased`);
            resetForms();
          } else {
            showError("Payment failed or was cancelled");
          }
        },
        onclose: function() {
          hideLoading();
        },
        customizations: {
          title: "MAVIZ Token Purchase",
          description: `Purchase of ${tokens.toFixed(2)} MVZx tokens`,
          logo: "https://i.imgur.com/VbxvCK6.jpeg"
        }
      });
    } catch (error) {
      showError(error.message);
      hideLoading();
    }
  }

  // 3. UI Functions
  function updateWalletDisplay() {
    const activeWallet = platformWallet || userWallet;
    
    if (activeWallet) {
      statusIndicator.classList.add('connected');
      walletStatus.querySelector('span').textContent = 'Wallet Connected';
      walletAddressInput.value = activeWallet.address;
      walletAddressDisplay.classList.remove('hidden');
      paymentMethods.classList.remove('hidden');
    }
  }

  function showPurchaseForm(type) {
    usdtForm.classList.add('hidden');
    cashForm.classList.add('hidden');
    
    if (type === 'usdt') {
      usdtForm.classList.remove('hidden');
    } else {
      cashForm.classList.remove('hidden');
    }
  }

  function updateUsdtTokenCalculation() {
    const amount = parseFloat(usdtAmountInput.value) || 0;
    const tokens = amount / TOKEN_PRICE_USDT;
    usdtTokensDisplay.textContent = `${tokens.toFixed(2)} MVZx`;
  }

  function updateCashTokenCalculation() {
    const amount = parseFloat(cashAmountInput.value) || 0;
    const usdtValue = amount / NAIRA_RATE;
    const tokens = usdtValue / TOKEN_PRICE_USDT;
    cashTokensDisplay.textContent = `${tokens.toFixed(2)} MVZx`;
  }

  // 4. Utility Functions
  function checkPersistedWallet() {
    const savedWallet = localStorage.getItem('mavizWallet');
    if (savedWallet) {
      const wallet = JSON.parse(savedWallet);
      if (wallet.isPlatform) {
        platformWallet = wallet;
      } else {
        userWallet = wallet.address;
      }
      updateWalletDisplay();
    }
  }

  function persistWallet() {
    const walletToSave = platformWallet || { address: userWallet };
    localStorage.setItem('mavizWallet', JSON.stringify(walletToSave));
  }

  function copyWalletAddress() {
    navigator.clipboard.writeText(walletAddressInput.value);
    copyAddressBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyAddressBtn.textContent = 'Copy';
    }, 2000);
  }

  function resetForms() {
    usdtAmountInput.value = '';
    cashAmountInput.value = '';
    updateUsdtTokenCalculation();
    updateCashTokenCalculation();
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function showLoading() {
    loadingDiv.classList.remove('hidden');
  }

  function hideLoading() {
    loadingDiv.classList.add('hidden');
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'error-message';
    successDiv.style.color = 'var(--success)';
    successDiv.style.backgroundColor = '#e8f5e9';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
  }
});
