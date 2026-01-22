import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AssignmentService } from './assignment.service';
import { Logger } from '@nestjs/common';

@Processor('booking-assignment', { concurrency: 5 })
export class AssignmentWorker extends WorkerHost {
  constructor(private readonly assignmentService: AssignmentService) {
    super();
  }

  private readonly logger = new Logger(AssignmentWorker.name);

  async process(job: Job) {
    this.logger.log(`[Worker] PROCESS METHOD CALLED - Processing job: ${job.name} id=${job.id} data=${JSON.stringify(job.data)}`);
    this.logger.log(`[Worker] Job name is: "${job.name}"`);
    this.logger.log(`[Worker] Job name type: ${typeof job.name}`);

    switch (job.name) {
      case 'assign-driver':
        this.logger.log('Starting assign-driver task');
        try {
          await this.assignmentService.tryToAssignDriver(job);
          this.logger.log('assign-driver task completed successfully');
        } catch (error) {
          this.logger.error('assign-driver task failed:', error);
          throw error;
        }
        break;

      case 'timeout-driver':
        this.logger.log('Starting timeout-driver task');
        try {
          await this.assignmentService.timeoutDriver(job);
          this.logger.log('timeout-driver task completed successfully');
        } catch (error) {
          this.logger.error('timeout-driver task failed:', error);
          throw error;
        }
        break;

      default:
        this.logger.log(`Unknown job name: "${job.name}"`);
        break;
    }
    this.logger.log(`[Worker] PROCESS METHOD FINISHED for job ${job.id}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job with id ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job with id ${job.id} COMPLETED!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job) {
    this.logger.log(`Job with id ${job.id} FAILED! Attempt Number ${job.attemptsMade}`);
  }
}
