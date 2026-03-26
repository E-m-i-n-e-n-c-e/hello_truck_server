/**
 * LibreDesk Utility
 *
 * Simple utility to create tickets and manage assignments in LibreDesk ticketing system
 */
import axios from 'axios';

interface CreateTicketParams {
  driverName: string;
  driverPhone: string;
  driverId: string;
  verificationType: string;
  requestId: string;
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
    requestId,
  } = params;

  console.log(`Creating LibreDesk ticket for driver: ${driverId}, request: ${requestId}`);

  const subject = `Driver Verification: ${driverName} (${verificationType})`;
  const content = `
New Driver Verification Request

Verification Type: ${verificationType === 'NEW_DRIVER' ? 'New Driver' : 'Existing Driver Re-verification'}

Driver Details:
- Name: ${driverName}
- Phone: ${driverPhone}
- Driver ID: ${driverId}
- Request ID: ${requestId}

Action Required:
Please review and verify the driver's documents in the admin portal.

Admin Portal Link: https://ht-admin-gilt.vercel.app/verifications/request/${requestId}
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
    if (response.data.data && response.data.data.uuid) {
      ticketId = response.data.data.uuid;
    } else if (response.data.uuid) {
      ticketId = response.data.uuid;
    } else if (response.data.conversation_uuid) {
      ticketId = response.data.conversation_uuid;
    } else {
      console.error('Unexpected LibreDesk response structure:', response.data);
      throw new Error('Could not find ticket UUID in LibreDesk response');
    }

    console.log(
      `LibreDesk ticket created successfully. Ticket UUID: ${ticketId}`,
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

/**
 * Assigns a LibreDesk conversation to a team.
 * Calls: PUT /api/v1/conversations/{uuid}/assignee/team
 * Body: { assignee_id: <teamId> }
 *
 * @param conversationUuid - The UUID of the LibreDesk conversation/ticket
 * @param teamId - The ID of the team to assign (3 = Field_Agents, 4 = Agents)
 * @param config - LibreDesk API configuration
 */
export async function assignLibreDeskTeam(
  conversationUuid: string,
  teamId: number,
  config: Pick<LibreDeskConfig, 'apiUrl' | 'apiKey' | 'apiSecret'>,
): Promise<void> {
  const credentials = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`,
  ).toString('base64');

  try {
    console.log(
      `Assigning LibreDesk conversation ${conversationUuid} to team ${teamId}`,
    );

    await axios.put(
      `${config.apiUrl}/api/v1/conversations/${conversationUuid}/assignee/team`,
      { assignee_id: teamId },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    console.log(
      `LibreDesk conversation ${conversationUuid} successfully assigned to team ${teamId}`,
    );
  } catch (error) {
    console.error(
      `Failed to assign LibreDesk conversation ${conversationUuid} to team ${teamId}`,
      error,
    );
    throw error;
  }
}
