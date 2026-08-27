import { buildCanonicalPayload, generateSessionCommitment, verifySessionCommitment } from '../lib/cryptoEngine';
import { BehavioralSession } from '../types';

describe('Phase 7: Cryptographic Provenance Engine', () => {
  
  const createBaseSession = (): BehavioralSession => ({
    id: 'ses-crypto-1',
    studentId: 'stu-001',
    studentName: 'Alice',
    type: 'graded_examination',
    examName: 'Crypto Midterm',
    examCode: 'CS101',
    startTime: '2026-08-18T10:00:00Z',
    endTime: '2026-08-18T11:00:00Z',
    duration: 60,
    questionCount: 2,
    deviceType: 'desktop',
    reviewStatus: 'normal',
    features: [
      {
        questionId: 'q-1',
        responseTime: 10,
        pointerMovement: 100,
        scrollDistance: 50,
        revisionCount: 1,
        pasteDetected: false,
        deviceType: 'desktop',
        sessionPosition: 0,
      },
      {
        questionId: 'q-2',
        responseTime: 20,
        pointerMovement: 200,
        scrollDistance: 100,
        revisionCount: 2,
        pasteDetected: true,
        deviceType: 'desktop',
        sessionPosition: 1,
      }
    ],
  });

  it('1. Same canonical payload -> same SHA-256 hash', async () => {
    const s1 = createBaseSession();
    const s2 = createBaseSession();

    const p1 = buildCanonicalPayload(s1);
    const p2 = buildCanonicalPayload(s2);

    expect(p1).toEqual(p2);

    const c1 = await generateSessionCommitment(p1);
    const c2 = await generateSessionCommitment(p2);

    expect(c1.hash).toEqual(c2.hash);
  });

  it('2. Changed responseTime -> different hash', async () => {
    const s1 = createBaseSession();
    const s2 = createBaseSession();
    s2.features[0].responseTime = 11; // altered

    const c1 = await generateSessionCommitment(buildCanonicalPayload(s1));
    const c2 = await generateSessionCommitment(buildCanonicalPayload(s2));

    expect(c1.hash).not.toEqual(c2.hash);
  });

  it('3. Changed revisionCount -> different hash', async () => {
    const s1 = createBaseSession();
    const s2 = createBaseSession();
    s2.features[1].revisionCount = 99; // altered

    const c1 = await generateSessionCommitment(buildCanonicalPayload(s1));
    const c2 = await generateSessionCommitment(buildCanonicalPayload(s2));

    expect(c1.hash).not.toEqual(c2.hash);
  });

  it('4. Changed question order -> canonicalization still deterministic', async () => {
    const s1 = createBaseSession();
    const s2 = createBaseSession();
    // Swap the order of features in the array
    s2.features = [s1.features[1], s1.features[0]];

    const p1 = buildCanonicalPayload(s1);
    const p2 = buildCanonicalPayload(s2);

    expect(p1).toEqual(p2); // Because it sorts by sessionPosition

    const c1 = await generateSessionCommitment(p1);
    const c2 = await generateSessionCommitment(p2);
    expect(c1.hash).toEqual(c2.hash);
  });

  it('5. Different sessionId -> different hash', async () => {
    const s1 = createBaseSession();
    const s2 = createBaseSession();
    s2.id = 'ses-crypto-2'; // changed ID

    const c1 = await generateSessionCommitment(buildCanonicalPayload(s1));
    const c2 = await generateSessionCommitment(buildCanonicalPayload(s2));

    expect(c1.hash).not.toEqual(c2.hash);
  });

  it('6. Verification succeeds for unchanged session', async () => {
    const s = createBaseSession();
    const payload = buildCanonicalPayload(s);
    const commitment = await generateSessionCommitment(payload);

    const isVerified = await verifySessionCommitment(payload, commitment.hash);
    expect(isVerified).toBe(true);
  });

  it('7. Verification fails after localStorage tampering', async () => {
    const s = createBaseSession();
    const payloadOrig = buildCanonicalPayload(s);
    const commitment = await generateSessionCommitment(payloadOrig);

    // Simulate tampering with the retrieved object from localStorage
    const tamperedSession = createBaseSession();
    tamperedSession.features[0].pasteDetected = true; 
    
    const tamperedPayload = buildCanonicalPayload(tamperedSession);
    const isVerified = await verifySessionCommitment(tamperedPayload, commitment.hash);
    
    expect(isVerified).toBe(false);
  });

  it('8. Empty payload handled safely', async () => {
    const s = createBaseSession();
    s.features = []; // no tracking data
    
    const payload = buildCanonicalPayload(s);
    const commitment = await generateSessionCommitment(payload);
    
    expect(commitment.hash).toBeDefined();
    expect(commitment.hash.length).toBeGreaterThan(0);
    
    const isVerified = await verifySessionCommitment(payload, commitment.hash);
    expect(isVerified).toBe(true);
  });

  it('9. Unicode/string serialization handled deterministically', async () => {
    const s1 = createBaseSession();
    s1.features[0].questionId = 'q-ñ-1'; // unicode
    
    const p1 = buildCanonicalPayload(s1);
    const c1 = await generateSessionCommitment(p1);
    
    const p2 = buildCanonicalPayload(s1);
    const c2 = await generateSessionCommitment(p2);
    
    expect(c1.hash).toEqual(c2.hash);
  });

  it('10. Commitment survives save/load serialization', async () => {
    const s = createBaseSession();
    const payload = buildCanonicalPayload(s);
    const commitment = await generateSessionCommitment(payload);
    
    s.cryptographicCommitment = commitment;

    // Simulate JSON.stringify -> localStorage -> JSON.parse
    const storedStr = JSON.stringify(s);
    const retrieved: BehavioralSession = JSON.parse(storedStr);

    expect(retrieved.cryptographicCommitment).toBeDefined();
    expect(retrieved.cryptographicCommitment?.hash).toEqual(commitment.hash);

    const retrievedPayload = buildCanonicalPayload(retrieved);
    const isVerified = await verifySessionCommitment(retrievedPayload, retrieved.cryptographicCommitment!.hash);
    expect(isVerified).toBe(true);
  });
});
