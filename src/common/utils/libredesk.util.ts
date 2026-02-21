/**
 * LibreDesk Utility
 *
 * Simple utility to create tickets in LibreDesk ticketing system
 */
import axios from 'axios';

interface CreateTicketParams {
  driverName: string;
  driverPhone: string;
  driverId: string;
  verificationType: string;
  verificationId: string;
}

interface LibreDeskConfig {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  inboxId: number;
}

/**
 * Creates a LibreDesk ticket for driver verification
 * @throws Error if ticket creation fails
 */
export async function createLibreDeskTicket(
  params: CreateTicketParams,
  config: LibreDeskConfig,
): Promise<string> {
  const {
    driverName,
    driverPhone,
    driverId,
    verificationType,
    verificationId,
  } = params;

  const subject = `Driver Verification: ${driverName} (${verificationType})`;
  const content = `
**New Driver Verification Request**

**Verification Type:** ${verificationType === 'NEW_DRIVER' ? 'New Driver' : 'Existing Driver Re-verification'}

**Driver Details:**
- Name: ${driverName}
- Phone: ${driverPhone}
- Driver ID: ${driverId}

**Verification Request ID:** ${verificationId}

**Action Required:**
Please review and verify the driver's documents in the admin portal.

**Admin Portal Link:** /verifications/driver/${driverId}
  `.trim();

  const credentials = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`,
  ).toString('base64');

  const response = await axios.post(
    `${config.apiUrl}/api/v1/conversations`,
    {
      subject,
      content,
      inbox_id: config.inboxId,
      contact_email: `driver_${driverId}@hellotruck.app`,
      first_name: driverName.split(' ')[0] || driverName,
      last_name: driverName.split(' ').slice(1).join(' ') || '',
      initiator: 'agent',
    },
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );

  return response.data.conversation_id || response.data.id.toString();
}
