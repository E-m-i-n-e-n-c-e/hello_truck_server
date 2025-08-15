import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';

interface ClassConstructor {
  new (...args: any[]): {};
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

export class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: ClassConstructor) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    //Run something before a request is handled by the controller
    return handler.handle().pipe(
      map((data: any) => {
        if (Array.isArray(data)) {
          return data.map((item) => plainToInstance(this.dto, item, {
            excludeExtraneousValues: true, // Exclude properties not decorated with @Expose()
            enableImplicitConversion: true, // Enable implicit conversion for nested objects
          }));
        }
        //Run something before the response is sent out
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true, // Exclude properties not decorated with @Expose()
          enableImplicitConversion: true, // Enable implicit conversion for nested objects
        });
      }),
    );
  }
}