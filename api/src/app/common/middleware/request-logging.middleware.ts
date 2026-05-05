import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogging');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestTimestamp = new Date().toISOString();
    
    // Log request received
    const method = req.method;
    const url = req.originalUrl || req.url;
    const userAgent = req.get('user-agent') || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    this.logger.log(
      `[REQUEST] ${method} ${url} | IP: ${ip} | Time: ${requestTimestamp}`
    );

    // Capture response finish event
    res.on('finish', () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const responseTimestamp = new Date().toISOString();
      const statusCode = res.statusCode;
      
      // Color code based on status and duration
      const statusEmoji = statusCode >= 500 ? '🔴' : statusCode >= 400 ? '🟡' : statusCode >= 300 ? '🔵' : '🟢';
      const durationEmoji = duration > 1000 ? '⚠️' : duration > 500 ? '⚡' : '✅';
      
      this.logger.log(
        `[RESPONSE] ${statusEmoji} ${method} ${url} | Status: ${statusCode} | Duration: ${duration}ms ${durationEmoji} | Time: ${responseTimestamp}`
      );
      
      // Log slow requests with more detail
      if (duration > 1000) {
        this.logger.warn(
          `[SLOW REQUEST] ${method} ${url} took ${duration}ms | IP: ${ip} | User-Agent: ${userAgent}`
        );
      }
    });

    next();
  }
}

