/**
 * Shared state between test files.
 * Tests run sequentially and can read/write to this object.
 */
export const testState = {
  // Customer state
  customerPhone: '',
  customerToken: '',
  customerId: '',
  addressId: '',
  gstId: '',

  // Driver state
  driverPhone: '',
  driverToken: '',
  driverId: '',

  // Booking state
  bookingId: '',
  assignmentId: '',
};
