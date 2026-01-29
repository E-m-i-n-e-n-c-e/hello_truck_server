import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';
import { Decimal } from '@prisma/client/runtime/library';
import { AUDIT_METADATA_KEY } from '../../audit-log/decorators/audit-log.decorator';

interface ClassConstructor {
  new (...args: any[]): {};
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

/**
 * Fields that should be preserved as-is without any transformation
 * These are typically JSON fields from the database that should not be processed
 */
const PRESERVE_JSON_FIELDS = ['beforeSnapshot', 'afterSnapshot'];

/**
 * Check if object or its nested objects contain any preserve fields
 * Returns early if no preserve fields found (performance optimization)
 */
function hasPreserveFields(obj: any): boolean {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some(item => hasPreserveFields(item));
  }

  // Check if any preserve field exists at this level
  for (const field of PRESERVE_JSON_FIELDS) {
    if (field in obj) {
      return true;
    }
  }

  // Check nested objects
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasPreserveFields(obj[key])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract JSON fields that should be preserved from transformation
 * Returns a map of field paths to their values
 */
function extractJsonFields(obj: any, path: string = '', extracted: Map<string, any> = new Map()): Map<string, any> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return extracted;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractJsonFields(item, `${path}[${index}]`, extracted);
    });
  } else {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fieldPath = path ? `${path}.${key}` : key;

        // If this is a field we want to preserve, store it
        if (PRESERVE_JSON_FIELDS.includes(key)) {
          extracted.set(fieldPath, obj[key]);
        }

        // Recursively check nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractJsonFields(obj[key], fieldPath, extracted);
        }
      }
    }
  }

  return extracted;
}

/**
 * Reattach preserved JSON fields to the serialized object
 */
function reattachJsonFields(obj: any, preserved: Map<string, any>, path: string = ''): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      reattachJsonFields(item, preserved, `${path}[${index}]`);
    });
  } else {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fieldPath = path ? `${path}.${key}` : key;

        // If we have a preserved value for this field, restore it
        if (preserved.has(fieldPath)) {
          obj[key] = preserved.get(fieldPath);
        }

        // Recursively process nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          reattachJsonFields(obj[key], preserved, fieldPath);
        }
      }
    }
  }
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

  intercept(_context: ExecutionContext, handler: CallHandler): Observable<any> {
    return handler.handle().pipe(
      map((data: any) => {
        // Step 1: Extract and remove audit metadata before any processing
        // This prevents it from being serialized or transformed
        const auditMetadata = data?.[AUDIT_METADATA_KEY];
        if (auditMetadata && typeof data === 'object' && !Array.isArray(data)) {
          delete data[AUDIT_METADATA_KEY];
        }

        // Step 2: Extract JSON fields only if they exist (performance optimization)
        const preservedJsonFields = hasPreserveFields(data)
          ? extractJsonFields(data)
          : new Map();

        // Step 3: Convert Prisma Decimals to numbers
        const convertedData = convertDecimalsToNumbers(data);

        // Step 4: Serialize using class-transformer
        let serialized: any;
        if (Array.isArray(convertedData)) {
          serialized = convertedData.map((item) => plainToInstance(this.dto, item, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
          }));
        } else {
          serialized = plainToInstance(this.dto, convertedData, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
          });
        }

        // Step 5: Reattach preserved JSON fields only if we extracted any
        if (preservedJsonFields.size > 0) {
          reattachJsonFields(serialized, preservedJsonFields);
        }

        // Step 6: Reattach audit metadata for AuditLogInterceptor
        if (auditMetadata) {
          serialized[AUDIT_METADATA_KEY] = auditMetadata;
        }

        return serialized;
      }),
    );
  }
}
