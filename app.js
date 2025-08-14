document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const createWalletBtn = document.getElementById('create-wallet-btn');
  const walletStatus = document.getElementById('wallet-status');
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.getElementById('status-text');
  const walletAddressDisplay = document.getElementById('wallet-address-display');
  const walletAddress = document.getElementById('wallet-address');
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
  const TOKEN_PRICE_NGN = 2000;
  const TOKEN_PRICE_USDT = 3.33;
  const TOKEN_RATE = TOKEN_PRICE_NGN / TOKEN_PRICE_USDT;
  let userWallet = null;
  let platformWallet = null;

  // Initialize
  checkPersistedWallet();

  // Event Listeners
  connectWalletBtn.addEventListener('click', connectExternalWallet);
  createWalletBtn.addEventListener('click', createPlatformWallet);
  copyAddressBtn.addEventListener('click', copyWalletAddress);
  payWithUsdtBtn.addEventListener('click', () => showPurchaseForm('usdt'));
  payWithCashBtn.addEventListener('click', () => showPurchaseForm('cash'));
  usdtAmountInput.addEventListener('input', updateUsdtTokenCalculation);
  cashAmountInput.addEventListener('input', updateCashTokenCalculation);
  confirmUsdtBtn.addEventListener('click', processUsdtPurchase);
  confirmCashBtn.addEventListener('click', processCashPurchase);

  // 1. Wallet Connection Functions
  async function connectExternalWallet() {
    showLoading();
    
    try {
      if (!window.ethereum) {
        if (isMobile()) {
          window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
          return;
        }
        throw new Error('No Ethereum provider found. Install MetaMask or similar wallet.');
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
      showError(`Connection failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  function createPlatformWallet() {
    showLoading();
    
    try {
      if (!platformWallet) {
        const seed = window.crypto.getRandomValues(new Uint32Array(10)).join('');
        platformWallet = ethers.Wallet.createRandom({
          extraEntropy: seed
        }).then(wallet => {
          return {
            address: wallet.address,
            privateKey: wallet.privateKey
          };
        });
      }
      
      updateWalletDisplay();
      persistWallet();
    } catch (error) {
      showError(`Wallet creation failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  function generatePlatformWallet(externalAddress) {
    // Deterministic platform wallet generation from external address
    const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(externalAddress + Date.now()));
    return {
      address: ethers.utils.getAddress(`0x${seed.substring(0,40)}`),
      privateKey: `0x${seed.substring(0,64)}`
    };
  }

  // 2. Purchase Processing
  async function processUsdtPurchase() {
    const amount = parseFloat(usdtAmountInput.value);
    const receivingWallet = document.getElementById('receiving-wallet').value;
    
    if (amount < TOKEN_PRICE_USDT) {
      showError(`Minimum purchase is $${TOKEN_PRICE_USDT} (₦${TOKEN_PRICE_NGN})`);
      return;
    }

    showLoading();
    
    try {
      // In production: Implement actual USDT contract call
      const tokens = amount / TOKEN_PRICE_USDT * 1000; // Assuming 1000 tokens per slot
      
      // Register in MLM system
      const mlmData = {
        walletAddress: receivingWallet === 'platform' ? platformWallet.address : userWallet,
        amount,
        tokens,
        paymentMethod: 'usdt',
        timestamp: Date.now()
      };
      
      // Here you would send mlmData to your backend
      console.log('USDT Purchase:', mlmData);
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
      
      showSuccess(`Success! Purchased ${tokens} MVZx tokens`);
      resetForms();
    } catch (error) {
      showError(`Transaction failed: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  function processCashPurchase() {
    const amount = parseFloat(cashAmountInput.value);
    const paymentMethod = document.getElementById('cash-method').value;
    
    if (amount < TOKEN_PRICE_NGN) {
      showError(`Minimum purchase is ₦${TOKEN_PRICE_NGN}`);
      return;
    }

    showLoading();
    
    try {
      const tokens = amount / TOKEN_PRICE_NGN * 1000; // Assuming 1000 tokens per slot
      
      FlutterwaveCheckout({
        public_key: process.env.FLUTTERWAVE_PUBLIC_KEY,
        tx_ref: 'MVZX-' + Date.now(),
        amount: amount,
        currency: paymentMethod === 'usd' ? 'USD' : 'NGN',
        payment_options: paymentMethod === 'bank' ? 'banktransfer' : 'card',
        customer: {
          email: "user@example.com", // Should collect in production
          phone_number: "2348012345678",
          name: "MVZx Buyer"
        },
        callback: function(response) {
          hideLoading();
          
          if (response.status === "successful") {
            // Register in MLM system
            const mlmData = {
              walletAddress: platformWallet.address,
              amount,
              tokens,
              paymentMethod: 'cash',
              paymentReference: response.transaction_id,
              timestamp: Date.now()
            };
            
            // Here you would send mlmData to your backend
            console.log('Cash Purchase:', mlmData);
            
            showSuccess(`Payment successful! ${tokens} MVZx tokens purchased`);
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
          description: `Purchase of ${tokens} MVZx tokens`,
          logo: "https://i.imgur.com/VbxvCK6.jpeg"
        }
      });
    } catch (error) {
      hideLoading();
      showError(`Payment initialization failed: ${error.message}`);
    }
  }

  // 3. UI Update Functions
  function updateWalletDisplay() {
    const activeWallet = platformWallet || userWallet;
    
    if (activeWallet) {
      statusIndicator.classList.add('connected');
      statusText.textContent = 'Wallet Connected';
      walletAddress.textContent = activeWallet.address;
      walletAddressDisplay.classList.remove('hidden');
      paymentMethods.classList.remove('hidden');
      
      // Show appropriate form if one is already selected
      if (usdtForm.classList.contains('hidden') && cashForm.classList.contains('hidden')) {
        payWithUsdtBtn.click();
      }
    }
  }

  function showPurchaseForm(type) {
    usdtForm.classList.add('hidden');
    cashForm.classList.add('hidden');
    
    if (type === 'usdt') {
      usdtForm.classList.remove('hidden');
      updateUsdtTokenCalculation();
    } else {
      cashForm.classList.remove('hidden');
      updateCashTokenCalculation();
    }
  }

  function updateUsdtTokenCalculation() {
    const amount = parseFloat(usdtAmountInput.value) || 0;
    const tokens = (amount / TOKEN_PRICE_USDT * 1000).toFixed(2);
    usdtTokensDisplay.textContent = `${tokens} MVZx`;
  }

  function updateCashTokenCalculation() {
    const amount = parseFloat(cashAmountInput.value) || 0;
    const tokens = (amount / TOKEN_PRICE_NGN * 1000).toFixed(2);
    cashTokensDisplay.textContent = `${tokens} MVZx`;
  }

  // 4. Utility Functions
  function checkPersistedWallet() {
    const savedWallet = localStorage.getItem('mavizPlatformWallet');
    if (savedWallet) {
      platformWallet = JSON.parse(savedWallet);
      updateWalletDisplay();
    }
  }

  function persistWallet() {
    if (platformWallet) {
      localStorage.setItem('mavizPlatformWallet', JSON.stringify(platformWallet));
    }
  }

  function copyWalletAddress() {
    navigator.clipboard.writeText(walletAddress.textContent);
    const originalText = copyAddressBtn.textContent;
    copyAddressBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyAddressBtn.textContent = originalText;
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
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
  }

  // Handle mobile return from wallet apps
  if (isMobile()) {
    window.addEventListener('focus', () => {
      if (window.ethereum?.selectedAddress && !userWallet) {
        connectExternalWallet();
      }
    });
  }
});
