import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>)
        : "Internal server error";

    const requestId = req.headers["x-request-id"] as string | undefined;

    if (status >= 500) {
      this.logger.error({ requestId, method: req.method, url: req.url, exception });
    }

    res.status(status).json({
      statusCode: status,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
      message,
    });
  }
}
