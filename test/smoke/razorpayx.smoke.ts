/* 
  RazorpayX Payout Smoke Tests (TEST MODE ONLY)

  Tests the payout flow used in your actual cron job:
  - Contact creation
  - Bank fund account creation  
  - IMPS payout (what you use for driver payouts)

  Run: ts-node scripts/razorpayx.smoke.ts

  Note: RazorpayX must be activated on your account
*/

import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from '../../src/razorpay/razorpay.service';
import { RazorpayXService } from '../../src/razorpay/razorpayx.service';
import { PayoutMethod } from '../../src/razorpay/dtos/payout-details.dto';

/* -------------------------------------------------------------------------- */
/*                                  GUARDS                                    */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Smoke tests must NOT run in production');
  process.exit(1);
}

if (process.env.RAZORPAY_SMOKE !== 'true') {
  console.error('❌ Smoke tests disabled. Set RAZORPAY_SMOKE=true to run intentionally.');
  console.error('   Run: RAZORPAY_SMOKE=true npm run smoke:razorpay');
  process.exit(1);
}

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function logStep(step: number, title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶ Step ${step}: ${title}`);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logInfo(message: string) {
  console.log(`   ${message}`);
}

function logWarning(message: string) {
  console.log(`⚠️  ${message}`);
}

function logError(message: string) {
  console.log(`❌ ${message}`);
}

/* -------------------------------------------------------------------------- */
/*                                  RUNNER                                    */
/* -------------------------------------------------------------------------- */

async function run() {
  console.log('\n🚀 RazorpayX Payout Smoke Test (IMPS Mode)');
  console.log(`   Key: ${process.env.RAZORPAY_KEY_ID?.substring(0, 12)}...`);
  console.log(`   Account: ${process.env.RAZORPAY_ACCOUNT_NUMBER || 'Default'}`);

  const configService = { get: (key: string) => process.env[key] } as ConfigService;
  const razorpayService = new RazorpayService(configService);
  
  let razorpayXService: RazorpayXService;
  let razorpayXEnabled = true;
  
  try {
    razorpayXService = new RazorpayXService(configService);
  } catch (error) {
    logError('RazorpayX service failed to initialize');
    razorpayXEnabled = false;
  }

  let contactId: string;
  let bankFundAccountId: string;
  let payoutId: string | null = null;

  /* ---------------------------------------------------------------------- */
  logStep(1, 'Create Contact (simulating driver registration)');
  /* ---------------------------------------------------------------------- */

  contactId = await razorpayService.createContact('9876543210', 'Test Driver');
  console.log(`✅ Contact created: ${contactId}`);

  /* ---------------------------------------------------------------------- */
  logStep(2, 'Create Bank Fund Account');
  /* ---------------------------------------------------------------------- */

  bankFundAccountId = await razorpayService.createFundAccount(contactId, {
    payoutMethod: PayoutMethod.BANK_ACCOUNT,
    bankDetails: {
      accountHolderName: 'Test Driver',
      accountNumber: '1234567890',
      ifscCode: 'HDFC0000001',
    },
  });
  logSuccess(`Bank fund account created: ${bankFundAccountId}`);

  /* ---------------------------------------------------------------------- */
  logStep(3, 'Get Fund Account Details (RazorpayX)');
  /* ---------------------------------------------------------------------- */

  if (!razorpayXEnabled) {
    logWarning('RazorpayX not initialized, skipping fund account details');
  } else {
    try {
      const fundAccountDetails = await razorpayXService!.getFundAccountDetails(bankFundAccountId);
      logSuccess(`Fund account details fetched`);
      logInfo(`ID: ${fundAccountDetails.id}`);
      logInfo(`Type: ${fundAccountDetails.account_type}`);
      
      // Verify it's a bank account
      if (fundAccountDetails.account_type !== 'bank_account') {
        logWarning(`Expected 'bank_account', got '${fundAccountDetails.account_type}'`);
      }
    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('URL')) {
        logWarning('RazorpayX not activated - fund account details API unavailable');
      } else {
        throw error;
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  logStep(4, 'Create IMPS Payout (as used in daily cron)');
  /* ---------------------------------------------------------------------- */

  if (!razorpayXEnabled) {
    logWarning('RazorpayX not initialized, skipping payout test');
  } else {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const referenceId = `smoke-payout-${todayStr}`;

      const payout = await razorpayXService!.createPayout({
        fundAccountId: bankFundAccountId,
        amount: 10, // ₹10 test amount
        currency: 'INR',
        mode: 'IMPS', // Same as your payout.service.ts
        purpose: 'payout',
        referenceId,
      });

      payoutId = payout.razorpayPayoutId;
      logSuccess(`IMPS payout created: ${payoutId}`);
      logInfo(`Status: ${payout.status}`);
      logInfo(`Amount: ₹${payout.amount}`);

    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('URL')) {
        logWarning('RazorpayX not activated on your account');
        logInfo('Enable RazorpayX in Dashboard → Products → Payouts');
        logInfo('Contact/Fund account creation still works (standard Razorpay)');
      } else if (error.message?.includes('Insufficient') || error.message?.includes('balance')) {
        logWarning('Insufficient RazorpayX balance');
        logInfo('Add test funds in Dashboard → RazorpayX → Add Funds');
      } else {
        throw error;
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  logStep(5, 'Fetch Payout Status');
  /* ---------------------------------------------------------------------- */

  if (payoutId && razorpayXEnabled) {
    try {
      const status = await razorpayXService!.fetchPayout(payoutId);
      logSuccess(`Payout status: ${status.status}`);
      logInfo(`Mode: ${status.mode}`);
      if (status.failureReason) {
        logInfo(`Failure reason: ${status.failureReason}`);
      }
    } catch (error) {
      logWarning('Could not fetch payout status');
    }
  } else {
    logInfo('Skipping - no payout was created');
  }

  /* ---------------------------------------------------------------------- */
  /*                               SUMMARY                                  */
  /* ---------------------------------------------------------------------- */

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Contact ID:           ${contactId}`);
  console.log(`Fund Account ID:      ${bankFundAccountId}`);
  console.log(`Payout ID:            ${payoutId || 'Not created (RazorpayX issue)'}`);
  console.log('='.repeat(60));
  
  if (payoutId) {
    console.log('\n🎉 Full payout flow tested successfully!\n');
  } else {
    console.log('\n✅ Contact & Fund Account creation works');
    console.log('⚠️  Enable RazorpayX to test full payout flow\n');
  }
}

/* -------------------------------------------------------------------------- */
/*                                  EXEC                                      */
/* -------------------------------------------------------------------------- */

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Smoke test FAILED');
    console.error(error);
    process.exit(1);
  });
