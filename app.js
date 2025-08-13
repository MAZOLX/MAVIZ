document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const metamaskBtn = document.getElementById('metamask-btn');
  const walletconnectBtn = document.getElementById('walletconnect-btn');
  const walletStatus = document.getElementById('wallet-status');
  const purchaseInterface = document.getElementById('purchase-interface');
  const amountInput = document.getElementById('amount');
  const buyBtn = document.getElementById('buy-btn');
  const purchaseSummary = document.getElementById('purchase-summary');
  const options = document.querySelectorAll('.option');

  // Configuration
  const BNB_CHAIN_ID = '0x38';
  const MVZX_RATE_NGN = 2000;
  const MVZX_RATE_USDT = 3.33;
  let currentCurrency = 'ngn';
  let userAddress = null;
  let provider = null;

  // Initialize
  checkWalletConnection();

  // Payment option selection
  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      currentCurrency = option.dataset.currency;
      updatePurchaseSummary();
    });
  });

  // MetaMask Connection
  metamaskBtn.addEventListener('click', async () => {
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
    } else {
      await connectMetaMask();
    }
  });

  // WalletConnect Connection
  walletconnectBtn.addEventListener('click', async () => {
    try {
      const walletConnectProvider = new WalletConnectProvider.default({
        rpc: { 56: "https://bsc-dataseed.binance.org/" },
        chainId: 56
      });

      await walletConnectProvider.enable();
      provider = new ethers.providers.Web3Provider(walletConnectProvider);
      userAddress = await provider.getSigner().getAddress();
      
      handleSuccessfulConnection();
    } catch (error) {
      showError(`WalletConnect failed: ${error.message}`);
    }
  });

  // Buy Button Handler
  buyBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    const slots = Math.floor(amount / (currentCurrency === 'ngn' ? MVZX_RATE_NGN : MVZX_RATE_USDT));
    
    if (amount < 2000) {
      showError('Minimum purchase is ₦2000');
      return;
    }

    if (currentCurrency === 'ngn') {
      processFlutterwavePayment(amount, slots);
    } else {
      processUSDTpayment(amount, slots);
    }
  });

  // Core Functions
  async function connectMetaMask() {
    if (!window.ethereum) {
      window.open("https://metamask.io/download.html", "_blank");
      return;
    }

    try {
      await switchToBNBChain();
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        userAddress = accounts[0];
        handleSuccessfulConnection();
      }
    } catch (error) {
      showError(`MetaMask connection failed: ${error.message}`);
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

  function handleSuccessfulConnection() {
    walletStatus.textContent = `Connected: ${shortenAddress(userAddress)}`;
    walletStatus.classList.add('connected');
    purchaseInterface.style.display = 'block';
    
    // Initialize amount listener
    amountInput.addEventListener('input', updatePurchaseSummary);
  }

  function updatePurchaseSummary() {
    const amount = parseFloat(amountInput.value) || 0;
    const rate = currentCurrency === 'ngn' ? MVZX_RATE_NGN : MVZX_RATE_USDT;
    const slots = Math.floor(amount / rate);
    const remainder = amount % rate;
    
    purchaseSummary.innerHTML = amount >= rate ? `
      <p>Purchasing: ${slots} slot(s)</p>
      ${remainder > 0 ? `<p>Remaining: ${remainder.toFixed(2)} ${currentCurrency.toUpperCase()}</p>` : ''}
    ` : '';
  }

  function processFlutterwavePayment(amount, slots) {
    FlutterwaveCheckout({
      public_key: "FLWPUBK_TEST-XXXXXXXXXXXXXXXX-X", // Replace with your key
      tx_ref: 'MVZX-' + Date.now(),
      amount: amount,
      currency: 'NGN',
      payment_options: 'card, banktransfer, ussd',
      customer: {
        email: "user@example.com", // Should collect in production
        phone_number: "08123456789",
        name: "MVZx Buyer"
      },
      callback: function(response) {
        if (response.status === "successful") {
          alert(`Success! Purchased ${slots} slots`);
          // Register purchase in your backend
        } else {
          showError("Payment failed");
        }
      },
      customizations: {
        title: "MVZx Token Purchase",
        description: `Purchase of ${slots} MLM slots`,
        logo: "https://i.imgur.com/VbxvCK6.jpeg"
      }
    });
  }

  function processUSDTpayment(amount, slots) {
    alert(`Would process USDT payment for ${slots} slots`);
    // Implement USDT payment logic
  }

  function checkWalletConnection() {
    if (window.ethereum?.selectedAddress) {
      userAddress = window.ethereum.selectedAddress;
      provider = new ethers.providers.Web3Provider(window.ethereum);
      handleSuccessfulConnection();
    }
  }

  // Helper Functions
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // Mobile return handler
  if (isMobile()) {
    window.addEventListener('focus', () => {
      if (window.ethereum?.selectedAddress && purchaseInterface.style.display === 'none') {
        checkWalletConnection();
      }
    });
  }
});
