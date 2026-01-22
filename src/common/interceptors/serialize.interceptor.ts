import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';
import { Decimal } from '@prisma/client/runtime/library';

interface ClassConstructor {
  new (...args: any[]): {};
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

/**
 * Recursively converts Prisma Decimal objects to numbers
 * This fixes the issue where Decimals are serialized as empty objects {}
 * Also handles BigInt conversion and preserves Date/Buffer objects
 */
function convertDecimalsToNumbers(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Check if it's a Prisma Decimal
  if (obj instanceof Decimal) {
    return obj.toNumber();
  }

  // Convert BigInt to number
  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  // Preserve Date objects - don't convert them
  if (obj instanceof Date) {
    return obj;
  }

  // Preserve Buffer objects (for binary data)
  if (Buffer.isBuffer(obj)) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertDecimalsToNumbers(item, seen));
  }

  // Handle objects (check for circular references)
  if (typeof obj === 'object') {
    // Prevent circular reference infinite loops
    if (seen.has(obj)) {
      return obj;
    }
    seen.add(obj);

    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertDecimalsToNumbers(obj[key], seen);
      }
    }
    return converted;
  }

  // Return primitive values as-is
  return obj;
}

export class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: ClassConstructor) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    //Run something before a request is handled by the controller
    return handler.handle().pipe(
      map((data: any) => {
        // Convert Prisma Decimals to numbers before serialization
        const convertedData = convertDecimalsToNumbers(data);

        if (Array.isArray(convertedData)) {
          return convertedData.map((item) => plainToInstance(this.dto, item, {
            excludeExtraneousValues: true, // Exclude properties not decorated with @Expose()
            enableImplicitConversion: true, // Enable implicit conversion for nested objects
          }));
        }
        //Run something before the response is sent out
        return plainToInstance(this.dto, convertedData, {
          excludeExtraneousValues: true, // Exclude properties not decorated with @Expose()
          enableImplicitConversion: true, // Enable implicit conversion for nested objects
        });
      }),
    );
  }
}