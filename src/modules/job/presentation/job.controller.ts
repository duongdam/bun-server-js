import { TrackJobUseCase } from '../application/use-cases/track-job.use-case';

export class JobController {
  private trackUseCase = new TrackJobUseCase();

  async getJobStatus(userId: string, jobId: string) {
    return this.trackUseCase.execute(userId, jobId);
  }
}
