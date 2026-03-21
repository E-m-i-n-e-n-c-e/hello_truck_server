import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cleanup script for invalid verification requests
 * 
 * Deletes verification requests for drivers who:
 * - Don't have a firstName (incomplete profile)
 * - Don't have documents (incomplete onboarding)
 * 
 * These requests were created by the cron job before the fix
 */
async function cleanupInvalidVerificationRequests() {
  console.log('🧹 Starting cleanup of invalid verification requests...\n');
  console.log('='.repeat(60));

  try {
    // Find all verification requests for drivers without firstName or documents
    const invalidRequests = await prisma.driverVerificationRequest.findMany({
      where: {
        driver: {
          OR: [
            { firstName: null },
            { documents: null },
          ],
        },
      },
      include: {
        driver: {
          select: {
            id: true,
            phoneNumber: true,
            firstName: true,
            documents: true,
          },
        },
      },
    });

    console.log(`Found ${invalidRequests.length} invalid verification requests\n`);

    if (invalidRequests.length === 0) {
      console.log('✅ No invalid requests found. Database is clean!');
      return { deletedCount: 0 };
    }

    // Show what will be deleted
    console.log('Invalid requests to be deleted:');
    console.log('-'.repeat(60));
    for (const request of invalidRequests) {
      const reason = !request.driver.firstName 
        ? 'No firstName' 
        : 'No documents';
      console.log(
        `  Request ID: ${request.id.substring(0, 8)}... | ` +
        `Driver: ${request.driver.phoneNumber} | ` +
        `Reason: ${reason} | ` +
        `Status: ${request.status}`
      );
    }
    console.log('-'.repeat(60));

    // Confirm deletion
    console.log(`\n⚠️  About to delete ${invalidRequests.length} verification requests`);
    console.log('This will also delete related:');
    console.log('  - Field verification photos');
    console.log('  - Document actions');
    console.log('  - Verification actions');
    console.log('  - Admin notifications (if any)');

    // Delete in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete related field photos
      const photosDeleted = await tx.fieldVerificationPhoto.deleteMany({
        where: {
          verificationRequestId: {
            in: invalidRequests.map(r => r.id),
          },
        },
      });

      // Delete related document actions
      const docActionsDeleted = await tx.verificationDocumentAction.deleteMany({
        where: {
          verificationRequestId: {
            in: invalidRequests.map(r => r.id),
          },
        },
      });

      // Delete related verification actions
      const verificationActionsDeleted = await tx.verificationAction.deleteMany({
        where: {
          verificationRequestId: {
            in: invalidRequests.map(r => r.id),
          },
        },
      });

      // Delete related admin notifications
      const notificationsDeleted = await tx.adminNotification.deleteMany({
        where: {
          entityId: {
            in: invalidRequests.map(r => r.id),
          },
          entityType: 'VERIFICATION',
        },
      });

      // Delete the verification requests
      const requestsDeleted = await tx.driverVerificationRequest.deleteMany({
        where: {
          id: {
            in: invalidRequests.map(r => r.id),
          },
        },
      });

      return {
        requestsDeleted: requestsDeleted.count,
        photosDeleted: photosDeleted.count,
        docActionsDeleted: docActionsDeleted.count,
        verificationActionsDeleted: verificationActionsDeleted.count,
        notificationsDeleted: notificationsDeleted.count,
      };
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ CLEANUP COMPLETED');
    console.log('='.repeat(60));
    console.log(`Verification requests deleted: ${result.requestsDeleted}`);
    console.log(`Field photos deleted: ${result.photosDeleted}`);
    console.log(`Document actions deleted: ${result.docActionsDeleted}`);
    console.log(`Verification actions deleted: ${result.verificationActionsDeleted}`);
    console.log(`Admin notifications deleted: ${result.notificationsDeleted}`);
    console.log('='.repeat(60));

    return result;
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  }
}

async function main() {
  try {
    await cleanupInvalidVerificationRequests();
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
