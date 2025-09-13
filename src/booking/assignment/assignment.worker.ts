import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AssignmentService } from './assignment.service';

@Processor('booking-assignment', { concurrency: 5 })
export class AssignmentWorker extends WorkerHost {
  constructor(private readonly assignmentService: AssignmentService) {
    super();
  }

  async process(job: Job) {
    console.log(`[Worker] PROCESS METHOD CALLED - Processing job: ${job.name} id=${job.id} data=${JSON.stringify(job.data)}`);
    console.log(`[Worker] Job name is: "${job.name}"`);
    console.log(`[Worker] Job name type: ${typeof job.name}`);

    switch (job.name) {
      case 'assign-driver':
        console.log('Starting assign-driver task');
        try {
          await this.assignmentService.tryToAssignDriver(job);
          console.log('assign-driver task completed successfully');
        } catch (error) {
          console.error('assign-driver task failed:', error);
          throw error;
        }
        break;

      case 'timeout-driver':
        console.log('Starting timeout-driver task');
        try {
          await this.assignmentService.timeoutDriver(job);
          console.log('timeout-driver task completed successfully');
        } catch (error) {
          console.error('timeout-driver task failed:', error);
          throw error;
        }
        break;

      default:
        console.log(`Unknown job name: "${job.name}"`);
        break;
    }
    console.log(`[Worker] PROCESS METHOD FINISHED for job ${job.id}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    console.log(`Processing job with id ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Job with id ${job.id} COMPLETED!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job) {
    console.log(`Job with id ${job.id} FAILED! Attempt Number ${job.attemptsMade}`);
  }
}
