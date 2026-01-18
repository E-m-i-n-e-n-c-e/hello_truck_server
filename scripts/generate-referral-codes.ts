import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from '../src/common/utils/referral-code.util';

const prisma = new PrismaClient();

const MAX_RETRIES = 5;

async function generateCustomerReferralCodes() {
  console.log('Fetching customers without referral codes...');
  
  const customers = await prisma.customer.findMany({
    where: {
      referralCode: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
    },
  });

  console.log(`Found ${customers.length} customers without referral codes`);

  let successCount = 0;
  let failCount = 0;

  for (const customer of customers) {
    let generated = false;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const code = generateReferralCode('CUS');
        
        await prisma.customer.update({
          where: { id: customer.id },
          data: { referralCode: code },
        });

        console.log(
          `✓ Generated code ${code} for customer: ${customer.firstName} ${customer.lastName || ''} (${customer.phoneNumber})`,
        );
        successCount++;
        generated = true;
        break;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`  Collision on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        console.error(
          `✗ Failed for customer ${customer.id} (${customer.phoneNumber}): ${error.message}`,
        );
        failCount++;
        break;
      }
    }

    if (!generated && successCount + failCount < customers.length) {
      console.error(
        `✗ Failed to generate unique code for customer ${customer.id} after ${MAX_RETRIES} attempts`,
      );
      failCount++;
    }
  }

  console.log(
    `\nCustomer Summary: ${successCount} successful, ${failCount} failed`,
  );
  return { successCount, failCount };
}

async function generateDriverReferralCodes() {
  console.log('\nFetching drivers without referral codes...');
  
  const drivers = await prisma.driver.findMany({
    where: {
      referralCode: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
    },
  });

  console.log(`Found ${drivers.length} drivers without referral codes`);

  let successCount = 0;
  let failCount = 0;

  for (const driver of drivers) {
    let generated = false;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const code = generateReferralCode('DRI');
        
        await prisma.driver.update({
          where: { id: driver.id },
          data: { referralCode: code },
        });

        console.log(
          `✓ Generated code ${code} for driver: ${driver.firstName} ${driver.lastName || ''} (${driver.phoneNumber})`,
        );
        successCount++;
        generated = true;
        break;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`  Collision on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        console.error(
          `✗ Failed for driver ${driver.id} (${driver.phoneNumber}): ${error.message}`,
        );
        failCount++;
        break;
      }
    }

    if (!generated && successCount + failCount < drivers.length) {
      console.error(
        `✗ Failed to generate unique code for driver ${driver.id} after ${MAX_RETRIES} attempts`,
      );
      failCount++;
    }
  }

  console.log(
    `\nDriver Summary: ${successCount} successful, ${failCount} failed`,
  );
  return { successCount, failCount };
}

async function main() {
  console.log('🚀 Starting referral code generation...\n');
  console.log('='.repeat(60));
  
  try {
    const customerResults = await generateCustomerReferralCodes();
    const driverResults = await generateDriverReferralCodes();

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Customers: ${customerResults.successCount} generated, ${customerResults.failCount} failed`);
    console.log(`Drivers: ${driverResults.successCount} generated, ${driverResults.failCount} failed`);
    console.log(`Total: ${customerResults.successCount + driverResults.successCount} generated, ${customerResults.failCount + driverResults.failCount} failed`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
