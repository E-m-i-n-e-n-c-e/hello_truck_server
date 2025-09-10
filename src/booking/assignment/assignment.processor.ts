import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AssignmentService } from './assignment.service';

@Processor('booking-assignment')
export class AssignmentProcessor extends WorkerHost {
  constructor(private readonly service: AssignmentService) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    switch (job.name) {
      case 'assign-driver':
        return this.service.tryToAssignDriver(job);
      case 'timeout-driver':
        return this.service.timeoutDriver(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
