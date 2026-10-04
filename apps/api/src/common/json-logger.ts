import { ConsoleLogger, LogLevel } from '@nestjs/common';

export class JsonLogger extends ConsoleLogger {
  protected printMessages(messages: unknown[], context?: string, logLevel?: LogLevel, writeStreamType?: 'stdout' | 'stderr') {
    messages.forEach((message) => {
      const output = {
        timestamp: new Date().toISOString(),
        level: logLevel,
        context: context || this.context,
        message: typeof message === 'string' ? message : message,
      };
      
      const jsonStr = JSON.stringify(output);
      
      if (writeStreamType === 'stderr') {
        process.stderr.write(jsonStr + '\n');
      } else {
        process.stdout.write(jsonStr + '\n');
      }
    });
  }
}
