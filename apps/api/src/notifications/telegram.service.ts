import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.isEnabled = !!this.botToken;
    if (!this.isEnabled) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram notifications will be disabled.');
    }
  }

  isConfigured(): boolean {
    return this.isEnabled;
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Message not sent.');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to send Telegram message to ${chatId}: ${response.status} ${response.statusText} - ${errorData}`);
        return false;
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(`Error sending Telegram message to ${chatId}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}
