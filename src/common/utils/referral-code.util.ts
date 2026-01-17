import { randomBytes } from 'crypto';

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateRandomPart(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let result = '';

  for (let i = 0; i < CODE_LENGTH; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }

  return result;
}

export function generateReferralCode(type: 'CUS' | 'DRI'): string {
  return `${type}-${generateRandomPart()}`;
}
