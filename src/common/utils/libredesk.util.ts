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
  } = params;

  console.log(`Creating LibreDesk ticket for driver: ${driverId}`);

  const subject = `Driver Verification: ${driverName} (${verificationType})`;
  const content = `
New Driver Verification Request

Verification Type: ${verificationType === 'NEW_DRIVER' ? 'New Driver' : 'Existing Driver Re-verification'}

Driver Details:
- Name: ${driverName}
- Phone: ${driverPhone}
- Driver ID: ${driverId}

Action Required:
Please review and verify the driver's documents in the admin portal.

Admin Portal Link: https://ht-admin-gilt.vercel.app//verifications/driver/${driverId}
  `.trim();

  const credentials = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`,
  ).toString('base64');

  try {
    console.log(
      `Sending request to LibreDesk API: ${config.apiUrl}/api/v1/conversations`,
    );

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

    console.log(
      'LibreDesk API Response:',
      JSON.stringify(response.data, null, 2),
    );

    // Handle different possible response structures
    let ticketId: string;
    if (response.data.data && response.data.data.id) {
      ticketId = response.data.data.id.toString();
    } else if (response.data.conversation_id) {
      ticketId = response.data.conversation_id.toString();
    } else if (response.data.id) {
      ticketId = response.data.id.toString();
    } else {
      console.error('Unexpected LibreDesk response structure:', response.data);
      throw new Error('Could not find ticket ID in LibreDesk response');
    }

    console.log(
      `LibreDesk ticket created successfully. Ticket ID: ${ticketId}`,
    );

    return ticketId;
  } catch (error) {
    console.error(
      `Failed to create LibreDesk ticket for driver ${driverId}`,
      error,
    );
    throw error;
  }
}
