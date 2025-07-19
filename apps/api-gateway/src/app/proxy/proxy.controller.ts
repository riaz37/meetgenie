import { Controller, All, Req, Res, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('auth/*')
  async proxyToAuthService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('auth-service', req, res, next);
  }

  @All('users/*')
  async proxyToUserService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('user-management-service', req, res, next);
  }

  @All('meetings/*')
  async proxyToMeetingService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('meeting-service', req, res, next);
  }

  @All('transcriptions/*')
  async proxyToTranscriptionService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('transcription-service', req, res, next);
  }

  @All('summaries/*')
  async proxyToSummaryService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('summarization-service', req, res, next);
  }

  @All('qa/*')
  async proxyToQAService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('qa-service', req, res, next);
  }

  @All('payments/*')
  async proxyToPaymentService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('payment-service', req, res, next);
  }

  @All('billing/*')
  async proxyToBillingService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('billing-service', req, res, next);
  }

  @All('admin/*')
  async proxyToAdminService(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    return this.proxyService.proxyRequest('admin-service', req, res, next);
  }
}