# Field Agent Flow Documentation

This document describes the role, responsibilities, and workflow of Field Agents in the Hello Truck Admin Portal.

---

## Overview

Field Agents are on-ground personnel who perform physical verification of drivers and vehicles. They bridge the gap between digital document verification and real-world validation, ensuring that drivers and vehicles meet safety and regulatory standards.

### Key Responsibilities
- **Physical Verification**: Visit driver locations to verify identity and vehicle
- **Photo Documentation**: Capture high-quality photos of driver, vehicle, and documents
- **On-Site Inspection**: Check vehicle condition and document authenticity
- **Evidence Collection**: Gather physical evidence for verification process
- **Field Reporting**: Report findings to verification agents

### Role in Verification Process
Field Agents provide **supplementary verification** - they don't approve/reject documents but provide additional evidence for agents to make informed decisions.

---

## Field Agent Capabilities

### What Field Agents CAN Do
✅ View assigned verification requests
✅ Upload field verification photos
✅ Delete own uploaded photos
✅ View driver details (name, phone, address, vehicle)
✅ View documents uploaded by driver
✅ Add notes about field visit
✅ Receive notifications for assignments

### What Field Agents CANNOT Do
❌ Approve or reject documents
❌ Approve or reject verifications
❌ Assign verifications
❌ Create verification requests
❌ Access refund features
❌ Access support features
❌ View audit logs
❌ Manage admin users

---

## Field Verification Workflow

### Phase 1: Assignment

**How Field Agents Get Assigned**:
1. Admin or Agent identifies verification needing field verification
2. Admin assigns verification to Field Agent
3. Field Agent receives FCM notification
4. Field Agent views assignment in mobile app/portal

**Assignment Criteria**:
- Geographic location (field agent covers specific areas)
- Workload (number of pending assignments)
- Specialization (some agents handle specific vehicle types)
- Availability (field agent's schedule)

**Notification Contains**:
- Driver name and phone number
- Driver address
- Vehicle details
- Verification request ID
- Priority level
- Deadline (if applicable)

---

### Phase 2: Preparation

**Before Visiting Driver**:

1. **Review Verification Request**
   - Endpoint: `GET /admin-api/verifications/:id`
   - Check driver details
   - Review uploaded documents
   - Note any red flags or concerns

2. **Contact Driver**
   - Call driver to schedule visit
   - Confirm address and availability
   - Inform driver about verification process
   - Request driver to have documents ready

3. **Plan Route**
   - Check driver location on map
   - Plan efficient route if multiple visits
   - Estimate travel time

4. **Prepare Equipment**
   - Smartphone/tablet with camera
   - Internet connection for uploads
   - Measuring tape (for vehicle dimensions)
   - Checklist of items to verify

---

### Phase 3: On-Site Verification

**At Driver Location**:

#### Step 1: Driver Identity Verification
- Verify driver matches photo in documents
- Check driver's physical appearance
- Verify driver can produce original documents
- Take driver selfie photo

**Photo Requirements**:
- Clear, well-lit face photo
- Driver holding Aadhaar card (number masked)
- Full face visible
- No sunglasses or caps

**Upload**:
- Photo Type: `DRIVER_SELFIE`
- Endpoint: `POST /admin-api/field-verification/photos`

---

#### Step 2: Vehicle Inspection

**Check Vehicle Condition**:
- Overall condition (body, paint, cleanliness)
- Tire condition
- Lights and indicators working
- Vehicle number plate matches RC Book
- Vehicle dimensions match specifications
- Load capacity appropriate

**Take Vehicle Photos**:

1. **Front View**
   - Full vehicle from front
   - Number plate clearly visible
   - Photo Type: `VEHICLE_FRONT`

2. **Back View**
   - Full vehicle from back
   - Number plate clearly visible
   - Photo Type: `VEHICLE_BACK`

3. **Side View**
   - Full vehicle from side
   - Shows vehicle length and body type
   - Photo Type: `VEHICLE_SIDE`

4. **Additional Photos** (if needed)
   - Damaged areas
   - Special features
   - Load area
   - Photo Type: `OTHER`

**Upload Each Photo**:
- Endpoint: `POST /admin-api/field-verification/photos`
- Include verification request ID
- Select appropriate photo type

---

#### Step 3: Document Verification

**Check Physical Documents**:

1. **Driving License**
   - Original document present
   - Not expired
   - Photo matches driver
   - Details match uploaded copy
   - Hologram/security features present

2. **RC Book (Registration Certificate)**
   - Original document present
   - Vehicle number matches
   - Owner details correct
   - Not expired
   - Proper stamps/signatures

3. **FC (Fitness Certificate)**
   - Original document present
   - Valid for vehicle type
   - Not expired
   - Issued by authorized center

4. **Insurance**
   - Original policy document
   - Valid coverage
   - Not expired
   - Vehicle details match

5. **Aadhaar Card**
   - Original document present
   - Photo matches driver
   - Details match uploaded copy
   - Verify address if possible

6. **PAN Card**
   - Original document present
   - Name matches other documents
   - Valid PAN format

**Take Document Photos**:
- Photo of each physical document
- Ensure text is readable
- Mask sensitive information (Aadhaar number)
- Photo Type: `DOCUMENTS`

**Upload**:
- Endpoint: `POST /admin-api/field-verification/photos`

---

#### Step 4: Additional Checks

**Vehicle Owner Verification** (if different from driver):
- Verify owner details from RC Book
- Check if owner authorization letter present
- Take photo of authorization letter
- Verify owner's Aadhaar (if available)

**Address Verification**:
- Confirm driver lives at stated address
- Check EB bill address matches
- Take photo of house/building (if permitted)
- Note any discrepancies

**Vehicle Measurements** (if required):
- Measure vehicle body length
- Measure load area dimensions
- Verify against specifications
- Document measurements

---

### Phase 4: Reporting

**Complete Field Visit**:

1. **Upload All Photos**
   - Minimum required:
     - 1 driver selfie
     - 3 vehicle photos (front, back, side)
     - Document photos
   - Optional:
     - Additional vehicle photos
     - Address verification photos
     - Owner verification photos

2. **Add Field Notes** (via support notes)
   - Endpoint: `POST /admin-api/support/bookings/:bookingId/notes`
   - Document findings:
     - Overall impression
     - Any concerns or red flags
     - Document authenticity assessment
     - Vehicle condition notes
     - Recommendations

3. **Mark Visit Complete**
   - Update assignment status
   - Notify agent that field verification is done

**Sample Field Note**:
```
Field Verification Completed - Driver: Rajesh Kumar

Driver Identity: ✓ Verified
- Driver matches photo in documents
- All original documents produced
- Cooperative and professional

Vehicle Condition: ✓ Good
- Tata Ace in good condition
- Clean and well-maintained
- Number plate matches RC Book (TN-01-AB-1234)
- All lights and indicators working

Documents: ✓ Authentic
- All documents appear genuine
- No signs of tampering
- Expiry dates valid
- Holograms and security features present

Address: ✓ Verified
- Driver resides at stated address
- EB bill address matches

Recommendation: APPROVE
No concerns found. Driver and vehicle meet all requirements.

Field Agent: Suresh M
Date: 2024-01-27 14:30 IST
```

---

## Photo Upload Guidelines

### Technical Requirements
- **Format**: JPEG or PNG
- **Size**: Maximum 5MB per photo
- **Resolution**: Minimum 1280x720 pixels
- **Quality**: Clear, not blurry
- **Lighting**: Well-lit, no shadows on important details

### Photo Best Practices

**DO**:
✅ Take photos in good lighting (daylight preferred)
✅ Ensure all text is readable
✅ Capture full subject (vehicle, document, driver)
✅ Hold camera steady (avoid blur)
✅ Take multiple angles if needed
✅ Mask sensitive information (Aadhaar number)
✅ Verify photo quality before uploading

**DON'T**:
❌ Take photos in poor lighting
❌ Include bystanders or other people
❌ Upload blurry or unclear photos
❌ Expose sensitive personal information
❌ Take photos without driver consent
❌ Upload photos from wrong verification

### Photo Upload Process

1. **Take Photo** with device camera
2. **Review Photo** for quality
3. **Select Photo Type** from dropdown
4. **Upload Photo**:
   ```typescript
   POST /admin-api/field-verification/photos
   {
     "verificationRequestId": "verification-id",
     "photoType": "DRIVER_SELFIE",
     "url": "https://storage.googleapis.com/..."
   }
   ```
5. **Verify Upload** successful
6. **Repeat** for all required photos

---

## Field Agent Tools and Equipment

### Required Equipment
1. **Smartphone/Tablet**
   - Good camera (minimum 12MP)
   - Internet connection (4G/WiFi)
   - Admin portal app installed
   - Sufficient storage space

2. **Measuring Tools**
   - Measuring tape (5-10 meters)
   - Digital caliper (for small measurements)

3. **Documentation**
   - Field verification checklist
   - Company ID card
   - Authorization letter

4. **Safety Equipment**
   - Reflective vest (for roadside inspections)
   - Flashlight (for dark areas)
   - First aid kit

### Mobile App Features
- View assigned verifications
- Navigate to driver location (GPS)
- Upload photos directly from camera
- Add field notes
- Mark verification complete
- Offline mode (sync when online)

---

## Common Scenarios

### Scenario 1: Driver Not Available
**Situation**: Field agent arrives but driver is not present

**Action**:
1. Call driver to confirm availability
2. Wait 15 minutes
3. If driver doesn't arrive:
   - Take photo of location
   - Add note: "Driver not available at scheduled time"
   - Reschedule visit
   - Notify agent

---

### Scenario 2: Documents Don't Match
**Situation**: Physical documents don't match uploaded copies

**Action**:
1. Take photos of both documents
2. Document discrepancies in detail
3. Add note with specific differences
4. Upload photos with type `DOCUMENTS`
5. Recommend rejection
6. Notify agent immediately

**Example Discrepancies**:
- Different license number
- Different vehicle number
- Expired documents (but uploaded shows valid)
- Photo doesn't match driver
- Signs of tampering

---

### Scenario 3: Vehicle in Poor Condition
**Situation**: Vehicle is damaged or unsafe

**Action**:
1. Take detailed photos of damage
2. Document safety concerns
3. Check if vehicle is roadworthy
4. Add detailed note about condition
5. Recommend rejection if unsafe
6. Notify agent

**Safety Concerns**:
- Bald tires
- Broken lights
- Structural damage
- Leaking fluids
- Excessive rust
- Non-functional brakes

---

### Scenario 4: Suspicious Documents
**Situation**: Documents appear fake or tampered

**Action**:
1. Take high-quality photos
2. Note specific concerns:
   - Missing security features
   - Poor print quality
   - Incorrect format
   - Suspicious stamps
3. Do NOT confront driver
4. Add detailed note
5. Recommend rejection
6. Notify agent and admin immediately

---

### Scenario 5: Driver Refuses Verification
**Situation**: Driver refuses to show documents or allow photos

**Action**:
1. Explain verification is mandatory
2. Show company authorization
3. If driver still refuses:
   - Do NOT force or argue
   - Document refusal
   - Take photo of location (if safe)
   - Add note: "Driver refused field verification"
   - Leave safely
   - Notify agent immediately
4. Verification will be rejected

---

## Safety Guidelines

### Personal Safety
- Always inform office before field visit
- Share live location with supervisor
- Visit during daylight hours when possible
- Avoid isolated locations alone
- Trust your instincts - leave if uncomfortable
- Keep phone charged and accessible

### Professional Conduct
- Wear company ID at all times
- Be polite and professional
- Respect driver's property
- Don't accept gifts or bribes
- Maintain confidentiality
- Follow company code of conduct

### COVID-19 Protocols (if applicable)
- Wear mask during visit
- Maintain social distance
- Sanitize hands before and after
- Avoid physical contact
- Minimize visit duration

---

## Performance Metrics

### Key Metrics for Field Agents
- **Verifications Completed**: Number of field visits completed
- **Average Time per Visit**: Efficiency metric
- **Photo Quality Score**: Based on agent feedback
- **Accuracy Rate**: How often field findings match final decision
- **Rejection Rate**: Percentage of drivers recommended for rejection
- **Response Time**: Time from assignment to completion

### Quality Indicators
- Clear, high-quality photos
- Detailed field notes
- Accurate assessments
- Timely completion
- Professional conduct
- Safety compliance

---

## Training Requirements

### Initial Training (2-3 days)
1. **Day 1: Theory**
   - Company policies
   - Verification process overview
   - Document authentication basics
   - Safety protocols
   - Mobile app training

2. **Day 2: Practical**
   - Photo taking techniques
   - Vehicle inspection methods
   - Document verification practice
   - Field note writing
   - Role-playing scenarios

3. **Day 3: Field Training**
   - Shadow experienced field agent
   - Conduct supervised verifications
   - Receive feedback
   - Complete certification test

### Ongoing Training
- Monthly refresher sessions
- New document security features
- Updated vehicle regulations
- Safety protocol updates
- Performance feedback sessions

---

## Troubleshooting

### Cannot Upload Photos
**Solutions**:
1. Check internet connection
2. Verify photo size < 5MB
3. Check storage space on device
4. Try different network (WiFi/4G)
5. Restart app
6. Contact technical support

### Cannot View Verification Details
**Solutions**:
1. Check if verification is assigned to you
2. Refresh app
3. Check internet connection
4. Verify login session is active
5. Contact supervisor

### Driver Location Incorrect
**Solutions**:
1. Call driver for correct address
2. Use GPS navigation
3. Update address in notes
4. Inform agent about discrepancy

---

## Best Practices

### For Efficient Field Work
1. **Batch Visits**: Group nearby verifications together
2. **Plan Route**: Use GPS to optimize travel
3. **Morning Calls**: Contact drivers early to schedule
4. **Prepare Checklist**: Review requirements before visit
5. **Upload Immediately**: Don't wait to upload photos

### For Quality Verification
1. **Be Thorough**: Check every detail
2. **Take Extra Photos**: Better to have more than less
3. **Document Everything**: Write detailed notes
4. **Ask Questions**: Clarify doubts with driver
5. **Trust Instincts**: Report any concerns

### For Professional Service
1. **Be Punctual**: Arrive on time
2. **Be Respectful**: Treat drivers professionally
3. **Be Clear**: Explain process to driver
4. **Be Honest**: Report findings accurately
5. **Be Safe**: Prioritize personal safety

---

## Conclusion

Field Agents play a crucial role in ensuring driver and vehicle safety. By providing physical verification and photo documentation, they help agents make informed decisions and maintain the quality and safety standards of the Hello Truck platform.

**Remember**: Your role is to provide evidence, not to make approval decisions. Be thorough, professional, and honest in your assessments.
