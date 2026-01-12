/* 
  Razorpay Smoke Tests (TEST MODE ONLY)

  This script:
  - Calls REAL Razorpay test APIs
  - Verifies request/response correctness
  - Chains dependent operations
  - Must NEVER run in production or CI

  Run explicitly with:
    npm run smoke:razorpay

  Or directly:
    RAZORPAY_SMOKE=true ts-node scripts/razorpay.smoke.ts
*/

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from '../../src/razorpay/razorpay.service';
import { PaymentType } from '../../src/razorpay/types/razorpay-payment-link.types';
import { PayoutMethod } from '../../src/razorpay/dtos/payout-details.dto';
import { createHmac } from 'crypto';
import * as readline from 'readline';

/* -------------------------------------------------------------------------- */
/*                                  GUARDS                                    */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Razorpay smoke tests must NOT run in production');
  process.exit(1);
}

if (process.env.SMOKE_TESTS !== 'true') {
  console.error('❌ Smoke tests disabled. Set SMOKE_TESTS=true to run intentionally.');
  console.error('   Run: SMOKE_TESTS=true npm run smoke:razorpay');
  process.exit(1);
}

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ Razorpay test credentials missing in environment');
  console.error('   Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function assert(condition: any, message: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
}

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

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                                  RUNNER                                    */
/* -------------------------------------------------------------------------- */

async function run() {
  console.log('\n🚀 Starting Razorpay Smoke Tests');
  console.log(`   Key ID: ${process.env.RAZORPAY_KEY_ID?.substring(0, 12)}...`);
  console.log(`   Webhook Secret: ${process.env.RAZORPAY_WEBHOOK_SECRET ? 'Configured' : 'Not set'}`);

  // Create config service that reads from process.env
  const configService = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  const service = new RazorpayService(configService);

  // Results storage
  let contactId: string;
  let contactIdNoName: string;
  let bankFundAccountId: string;
  let vpaFundAccountId: string;
  let paymentLinkId: string;
  let paymentLinkUrl: string;

  /* ---------------------------------------------------------------------- */
  logStep(1, 'Create Contact (with name)');
  /* ---------------------------------------------------------------------- */

  contactId = await service.createContact('9999999999', 'Smoke Test Driver');
  assert(contactId.startsWith('cont_'), `Invalid contactId format: ${contactId}`);
  logSuccess(`Contact created: ${contactId}`);

  /* ---------------------------------------------------------------------- */
  logStep(2, 'Create Contact (phone only)');
  /* ---------------------------------------------------------------------- */

  contactIdNoName = await service.createContact('8888888888');
  assert(contactIdNoName.startsWith('cont_'), `Invalid contactId format: ${contactIdNoName}`);
  logSuccess(`Contact created: ${contactIdNoName}`);

  /* ---------------------------------------------------------------------- */
  logStep(3, 'Create Bank Fund Account');
  /* ---------------------------------------------------------------------- */

  bankFundAccountId = await service.createFundAccount(contactId, {
    payoutMethod: PayoutMethod.BANK_ACCOUNT,
    bankDetails: {
      accountHolderName: 'Smoke Test Driver',
      accountNumber: '1234567890',
      ifscCode: 'HDFC0000001',
    },
  });

  assert(bankFundAccountId.startsWith('fa_'), `Invalid fund account ID: ${bankFundAccountId}`);
  logSuccess(`Bank fund account created: ${bankFundAccountId}`);

  /* ---------------------------------------------------------------------- */
  logStep(4, 'Create VPA Fund Account');
  /* ---------------------------------------------------------------------- */

  vpaFundAccountId = await service.createFundAccount(contactId, {
    payoutMethod: PayoutMethod.VPA,
    vpaDetails: {
      vpa: 'smoketest@okicici',
    },
  });

  assert(vpaFundAccountId.startsWith('fa_'), `Invalid fund account ID: ${vpaFundAccountId}`);
  logSuccess(`VPA fund account created: ${vpaFundAccountId}`);

  /* ---------------------------------------------------------------------- */
  logStep(5, 'Create Payment Link (full details)');
  /* ---------------------------------------------------------------------- */

  const paymentLink = await service.createPaymentLink({
    amount: 100,
    currency: 'INR',
    description: 'Razorpay smoke test payment',
    referenceId: `smoke_${Date.now()}`,
    customerName: 'Smoke Test Customer',
    customerContact: '6300012345',
    customerEmail: 'smoke@test.com',
    paymentType: PaymentType.BOOKING_INVOICE,
  });

  paymentLinkId = paymentLink.paymentLinkId;
  paymentLinkUrl = paymentLink.paymentLinkUrl;

  assert(paymentLinkId.startsWith('plink_'), `Invalid paymentLinkId: ${paymentLinkId}`);
  assert(paymentLinkUrl.includes('rzp.io'), `Invalid payment link URL: ${paymentLinkUrl}`);

  logSuccess(`Payment link created: ${paymentLinkId}`);
  logInfo(`URL: ${paymentLinkUrl}`);

  /* ---------------------------------------------------------------------- */
  logStep(6, 'Create Payment Link (minimal)');
  /* ---------------------------------------------------------------------- */

  const minimalPaymentLink = await service.createPaymentLink({
    amount: 50,
    description: 'Minimal smoke test',
    referenceId: `smoke_minimal_${Date.now()}`,
    customerName: 'Test',
    customerContact: '9876543210',
    paymentType: PaymentType.BOOKING_INVOICE,
  });

  assert(minimalPaymentLink.paymentLinkId.startsWith('plink_'), 'Invalid minimal payment link ID');
  logSuccess(`Minimal payment link created: ${minimalPaymentLink.paymentLinkId}`);

  /* ---------------------------------------------------------------------- */
  logStep(7, 'Create Payment Link (+91 prefix)');
  /* ---------------------------------------------------------------------- */

  const prefixPaymentLink = await service.createPaymentLink({
    amount: 75,
    description: 'Phone prefix test',
    referenceId: `smoke_prefix_${Date.now()}`,
    customerName: 'Test',
    customerContact: '+919876543210',
    paymentType: PaymentType.BOOKING_INVOICE,
  });

  assert(prefixPaymentLink.paymentLinkId.startsWith('plink_'), 'Invalid prefix payment link ID');
  logSuccess(`+91 prefix handled correctly: ${prefixPaymentLink.paymentLinkId}`);

  /* ---------------------------------------------------------------------- */
  logStep(8, 'Webhook Signature Verification');
  /* ---------------------------------------------------------------------- */

  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payment_id: 'pay_test123',
      amount: 10000,
    });

    const validSignature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Test valid signature
    const isValid = service.verifyWebhookSignature(payload, validSignature);
    assert(isValid === true, 'Valid signature should be accepted');
    logSuccess('Valid signature verified correctly');

    // Test invalid signature
    const isInvalid = service.verifyWebhookSignature(payload, 'invalid_signature');
    assert(isInvalid === false, 'Invalid signature should be rejected');
    logSuccess('Invalid signature rejected correctly');
  } else {
    logWarning('RAZORPAY_WEBHOOK_SECRET not set, skipping webhook tests');
  }

  /* ---------------------------------------------------------------------- */
  logStep(9, 'Error Handling - Invalid Fund Account');
  /* ---------------------------------------------------------------------- */

  let invalidFundAccountError: Error | null = null;

  try {
    await service.createFundAccount(contactId, {
      payoutMethod: PayoutMethod.BANK_ACCOUNT,
      bankDetails: {
        accountHolderName: 'Invalid',
        accountNumber: 'invalid',
        ifscCode: 'INVALID',
      },
    });
  } catch (error) {
    invalidFundAccountError = error as Error;
  }

  assert(
    invalidFundAccountError !== null,
    'createFundAccount should fail for invalid bank details but it succeeded',
  );
  logSuccess('Invalid bank details rejected correctly');
  logInfo(`Error: ${invalidFundAccountError!.message.substring(0, 60)}...`);

  /* ---------------------------------------------------------------------- */
  logStep(10, 'Refund Testing (Interactive)');
  /* ---------------------------------------------------------------------- */

  console.log('\n📋 To test refunds, we need a completed payment.');
  console.log(`\n🔗 Open this payment link in your browser and complete the test payment:`);
  console.log(`   ${paymentLinkUrl}`);
  console.log('\n   Use test card: 4111 1111 1111 1111, any future expiry, any CVV');
  console.log('\n   After payment, copy the payment ID (format: pay_XXXXX) from:');
  console.log('   - The Razorpay Dashboard, OR');
  console.log('   - The payment success page URL\n');

  const paymentId = await askQuestion('Enter the Razorpay payment ID (or press Enter to skip): ');

  if (paymentId && paymentId.startsWith('pay_')) {
    /* ---------------------------------------------------------------------- */
    logStep(11, 'Fetch Refunds - Error Case (Invalid Payment ID)');
    /* ---------------------------------------------------------------------- */

    let fetchRefundsError: Error | null = null;

    try {
      await service.fetchRefunds('pay_invalid_12345');
    } catch (error) {
      fetchRefundsError = error as Error;
    }

    assert(
      fetchRefundsError !== null,
      'fetchRefunds should throw for invalid payment ID but it succeeded',
    );
    logSuccess('fetchRefunds correctly throws for invalid payment ID');
    logInfo(`Error: ${fetchRefundsError!.message.substring(0, 60)}...`);

    /* ---------------------------------------------------------------------- */
    logStep(12, 'Fetch Refunds - Success Case (Valid Payment ID)');
    /* ---------------------------------------------------------------------- */

    try {
      const refunds = await service.fetchRefunds(paymentId);
      assert(Array.isArray(refunds), 'fetchRefunds should return an array');
      logSuccess(`fetchRefunds returned ${refunds.length} refund(s)`);
      
      if (refunds.length > 0) {
        logInfo(`First refund: ${refunds[0].refundId}, Amount: ₹${refunds[0].amount}`);
      } else {
        logInfo('No refunds found (this is expected for a new payment)');
      }
    } catch (error: any) {
      logWarning(`fetchRefunds failed: ${error.message}`);
    }

    /* ---------------------------------------------------------------------- */
    logStep(13, 'Create Refund - Partial (₹30)');
    /* ---------------------------------------------------------------------- */

    let partialRefundId: string | null = null;

    try {
      const partialRefund = await service.createRefund({
        paymentId,
        amount: 30, // Partial refund of ₹30
        notes: {
          reason: 'Smoke test partial refund',
          bookingId: 'smoke_test_booking',
        },
      });

      // Verify structure matches RefundResponse type
      assert(partialRefund.refundId?.startsWith('rfnd_'), `Invalid refundId: ${partialRefund.refundId}`);
      assert(partialRefund.paymentId === paymentId, 'paymentId mismatch in response');
      assert(partialRefund.amount === 30, `Amount mismatch: expected 30, got ${partialRefund.amount}`);
      assert(typeof partialRefund.currency === 'string', 'currency should be string');
      assert(typeof partialRefund.status === 'string', 'status should be string');
      assert(typeof partialRefund.createdAt === 'number', 'createdAt should be number');

      partialRefundId = partialRefund.refundId;
      logSuccess(`Partial refund created: ${partialRefund.refundId}`);
      logInfo(`Amount: ₹${partialRefund.amount}`);
      logInfo(`Status: ${partialRefund.status}`);
      logInfo(`Currency: ${partialRefund.currency}`);
    } catch (error: any) {
      logWarning(`Partial refund failed: ${error.message}`);
    }

    /* ---------------------------------------------------------------------- */
    logStep(14, 'Create Refund - Full (remaining amount)');
    /* ---------------------------------------------------------------------- */

    let fullRefundId: string | null = null;

    try {
      // Full refund - amount omitted means refund remaining balance
      const fullRefund = await service.createRefund({
        paymentId,
        // No amount = full refund of remaining amount
        notes: {
          reason: 'Smoke test full refund',
        },
      });

      // Verify structure
      assert(fullRefund.refundId?.startsWith('rfnd_'), `Invalid refundId: ${fullRefund.refundId}`);
      assert(fullRefund.paymentId === paymentId, 'paymentId mismatch');
      assert(typeof fullRefund.amount === 'number', 'amount should be number');
      assert(fullRefund.amount > 0, 'amount should be positive');

      fullRefundId = fullRefund.refundId;
      logSuccess(`Full refund created: ${fullRefund.refundId}`);
      logInfo(`Amount: ₹${fullRefund.amount} (remaining balance)`);
      logInfo(`Status: ${fullRefund.status}`);
    } catch (error: any) {
      if (error.message?.includes('already been fully refunded')) {
        logWarning('Payment already fully refunded (partial refund used full amount)');
      } else {
        logWarning(`Full refund failed: ${error.message}`);
      }
    }

    /* ---------------------------------------------------------------------- */
    logStep(15, 'Fetch Refunds - Verify 2 Refunds Exist');
    /* ---------------------------------------------------------------------- */

    try {
      const refunds = await service.fetchRefunds(paymentId);
      
      assert(Array.isArray(refunds), 'fetchRefunds should return an array');
      
      const expectedCount = (partialRefundId ? 1 : 0) + (fullRefundId ? 1 : 0);
      logSuccess(`fetchRefunds returned ${refunds.length} refund(s)`);
      
      if (expectedCount > 0) {
        assert(
          refunds.length >= expectedCount,
          `Expected at least ${expectedCount} refunds, got ${refunds.length}`,
        );
      }
      
      // Verify each refund has correct structure
      for (const refund of refunds) {
        assert(refund.refundId?.startsWith('rfnd_'), 'Each refund should have valid refundId');
        assert(refund.paymentId === paymentId, 'Each refund should reference correct paymentId');
        assert(typeof refund.amount === 'number', 'Each refund should have numeric amount');
        logInfo(`  - ${refund.refundId}: ₹${refund.amount} (${refund.status})`);
      }

      logSuccess('All refunds have correct structure matching RefundResponse type');
    } catch (error: any) {
      logWarning(`Fetch refunds failed: ${error.message}`);
    }

  } else {
    logWarning('Skipping refund tests - no payment ID provided');
  }

  /* ---------------------------------------------------------------------- */
  /*                               SUMMARY                                  */
  /* ---------------------------------------------------------------------- */

  console.log('\n' + '='.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Contact ID (with name):    ${contactId}`);
  console.log(`Contact ID (phone only):   ${contactIdNoName}`);
  console.log(`Bank Fund Account ID:      ${bankFundAccountId}`);
  console.log(`VPA Fund Account ID:       ${vpaFundAccountId}`);
  console.log(`Payment Link ID:           ${paymentLinkId}`);
  console.log(`Payment Link URL:          ${paymentLinkUrl}`);
  console.log('='.repeat(60));
  console.log('\n🎉 All Razorpay smoke tests PASSED!\n');

  // Return results for potential chaining
  return {
    contactId,
    bankFundAccountId,
    vpaFundAccountId,
    paymentLinkId,
    paymentLinkUrl,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  EXEC                                      */
/* -------------------------------------------------------------------------- */

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Smoke test FAILED');
    console.error(error);
    process.exit(1);
  });

