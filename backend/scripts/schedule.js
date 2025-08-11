const { exec } = require('child_process');
const cron = require('node-cron');

// Update every 6 hours (adjust as needed)
cron.schedule('0 */6 * * *', () => {
  exec('npm run update-rates', (error, stdout, stderr) => {
    if (error) {
      console.error('Scheduled update failed:', error);
      return;
    }
    console.log(`Scheduled rate update: ${new Date().toISOString()}\n${stdout}`);
  });
});

console.log('⏰ Exchange rate scheduler running...');
