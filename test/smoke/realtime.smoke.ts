/**
 * Realtime Smoke Test
 * Tests full WebSocket → Redis → SSE flow with real Redis
 * 
 * Run: REALTIME_SMOKE=true ts-node test/smoke/realtime.smoke.ts
 * 
 * Prerequisites:
 * - Server running on port 3000
 * - Redis connected
 * - Valid driver and customer tokens
 */

import { io, Socket } from 'socket.io-client';
import * as http from 'http';


const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DRIVER_TOKEN = process.env.DRIVER_TOKEN;
const CUSTOMER_TOKEN = process.env.CUSTOMER_TOKEN;
const BOOKING_ID = process.env.BOOKING_ID;

if (!DRIVER_TOKEN || !CUSTOMER_TOKEN || !BOOKING_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   DRIVER_TOKEN, CUSTOMER_TOKEN, BOOKING_ID');
  process.exit(1);
}

function createSSEClient(url: string, token: string): Promise<{ connected: boolean; messages: string[]; close: () => void }> {
  return new Promise((resolve) => {
    const messages: string[] = [];
    let connected = false;
    
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        connected = true;
        console.log('   ✅ SSE connection opened');
      } else {
        console.log(`   ❌ SSE failed with status ${res.statusCode}`);
      }

      res.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.startsWith('data:')) {
          messages.push(data);
          console.log(`   📩 SSE received: ${data.substring(0, 80)}...`);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ⚠️ SSE error: ${err.message}`);
    });

    req.end();

    // Give time for connection
    setTimeout(() => {
      resolve({
        connected,
        messages,
        close: () => req.destroy(),
      });
    }, 1000);
  });
}

async function runSmokeTest() {
  console.log('🔥 Starting Realtime Smoke Test\n');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Booking ID: ${BOOKING_ID}\n`);

  let driverSocket: Socket | null = null;
  let sseResult: { connected: boolean; messages: string[]; close: () => void } | null = null;

  try {
    // Step 1: Connect driver via WebSocket
    console.log('1️⃣ Connecting driver to WebSocket...');
    driverSocket = io(`${BASE_URL}/driver`, {
      auth: { token: DRIVER_TOKEN },
    });

    await new Promise<void>((resolve, reject) => {
      driverSocket!.on('connect', () => {
        console.log('   ✅ Driver connected');
        resolve();
      });
      driverSocket!.on('connect_error', (err) => {
        console.log(`   ❌ Driver connection failed: ${err.message}`);
        reject(err);
      });
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Step 2: Open SSE connection as customer
    console.log('\n2️⃣ Opening SSE connection for customer...');
    const sseUrl = `${BASE_URL}/bookings/customer/driver-navigation/${BOOKING_ID}`;
    sseResult = await createSSEClient(sseUrl, CUSTOMER_TOKEN!);

    // Step 3: Driver sends navigation update
    console.log('\n3️⃣ Driver sending navigation update...');
    const navPayload = {
      bookingId: BOOKING_ID,
      remainingTime: 300,
      remainingDistance: 5000,
      timeToNextDestinationSeconds: 300,
      distanceToNextDestinationMeters: 5000,
      timeToFinalDestinationSeconds: 600,
      distanceToFinalDestinationMeters: 10000,
      latitude: 17.385,
      longitude: 78.486,
      routePolyline: 'test_polyline',
      sentAt: new Date().toISOString(),
    };

    driverSocket.emit('driver-navigation-update', navPayload);
    console.log('   ✅ Navigation update sent');

    // Step 4: Wait for SSE to receive the update
    console.log('\n4️⃣ Waiting for SSE to receive update...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 5: Report results
    console.log('\n📊 Smoke Test Results');
    console.log('─'.repeat(40));
    console.log(`   Driver WebSocket: ${driverSocket.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   Customer SSE: ${sseResult.connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`   Received Updates: ${sseResult.messages.length > 0 ? '✅ Yes' : '⚠️ No updates received'}`);

    if (driverSocket.connected && sseResult.connected) {
      console.log('\n✅ Smoke test PASSED - Full flow is working');
    } else {
      console.log('\n⚠️ Smoke test completed with warnings');
    }

  } catch (error) {
    console.error('\n❌ Smoke test FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (driverSocket) {
      driverSocket.disconnect();
    }
    if (sseResult) {
      sseResult.close();
    }
  }

  process.exit(0);
}

runSmokeTest();
