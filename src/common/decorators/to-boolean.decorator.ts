import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';

export function ToBoolean() {
  return Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new BadRequestException(`${value} must be a boolean (true or false)`);
  });
}
