// M-EDU AI Copilot — integration pass
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

// Interface definitions to avoid any
interface GenAiModelParams {
  model: string;
  contents: { role: string; parts: { text: string }[] }[];
  config: { systemInstruction: string; temperature: number };
}

interface GenAiModelResponse {
  text?: string;
}

interface GenAiClientModels {
  generateContent(params: GenAiModelParams): Promise<GenAiModelResponse>;
  generateContentStream(params: GenAiModelParams): Promise<{ stream: AsyncIterable<{ text: string }> }>;
}

interface GenAiClient {
  models: GenAiClientModels;
}

export interface ChatHistoryItem {
  role: string;
  content: string;
}

export interface AiChatResponse {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  conversationId?: string;
}

export interface AiInsight {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  metric?: string;
  trend?: 'up' | 'down' | 'flat';
}

let GoogleGenAIClass: new (config: { apiKey: string }) => GenAiClient | null = null as unknown as new (config: { apiKey: string }) => GenAiClient;
try {
  const genai = require('@google/genai');
  GoogleGenAIClass = genai.GoogleGenAI;
} catch {
  // Safe fallback
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private aiInstance: GenAiClient | null = null;
  private readonly primaryModel: string;
  private readonly fallbackModels = ['gemini-3.8-flash', 'gemini-3.8-flash'];
  private insightsCache = new Map<string, { data: any, timestamp: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.primaryModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.8-flash';
  }

  private getAiClient(): GenAiClient | null {
    if (this.aiInstance) return this.aiInstance;
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    if (!apiKey || !GoogleGenAIClass) return null;

    try {
      this.aiInstance = new GoogleGenAIClass({ apiKey });
      return this.aiInstance;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('Failed to initialize GoogleGenAI client: ' + msg);
      return null;
    }
  }

  async getConversations(organizationId: string, userId: string, limit: number) {
    const rows = await this.prisma.aiConversation.findMany({
      where: { organizationId, createdBy: userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        preview: true,
        updatedAt: true,
        messageCount: true
      }
    });
    return rows;
  }

  async createConversation(organizationId: string, userId: string, title?: string) {
    const conv = await this.prisma.aiConversation.create({
      data: {
        organizationId,
        createdBy: userId,
        title: title ?? 'New conversation',
        preview: '',
        messageCount: 0
      }
    });
    return { id: conv.id };
  }

  async getMessages(organizationId: string, userId: string, conversationId: string) {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, organizationId, createdBy: userId }
    });
    if (!conv) throw new HttpException('Not found or no permission', HttpStatus.FORBIDDEN);

    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId, organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      }
    });
    return messages;
  }

  async deleteConversation(organizationId: string, userId: string, conversationId: string) {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, organizationId, createdBy: userId }
    });
    if (!conv) throw new HttpException('Not found or no permission', HttpStatus.FORBIDDEN);
    
    await this.prisma.aiConversation.delete({
      where: { id: conversationId }
    });
  }

  async getInsights(organizationId: string, userId: string, scope: string, pageContext: string) {
    const cacheKey = `${organizationId}-${userId}-${scope}-${pageContext}`;
    const cached = this.insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    const insights: AiInsight[] = [];
    
    try {
      if (scope === 'global' || pageContext === '/attendance') {
        const today = new Date();
        today.setHours(0,0,0,0);
        const absentCount = await this.prisma.attendance.count({
          where: { organizationId, status: 'ABSENT', date: { gte: today } }
        });
        if (absentCount > 0) {
          insights.push({
            id: 'att-1',
            type: absentCount > 10 ? 'warning' : 'info',
            title: 'Attendance Alert',
            body: `${absentCount} students are absent today.`,
            metric: `${absentCount}`,
            trend: 'down'
          });
        }
      }
      
      if (scope === 'global' || pageContext === '/payments') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const latePayments = await this.prisma.invoice.count({
          where: { organizationId, status: 'OVERDUE' }
        });
        if (latePayments > 0) {
          insights.push({
            id: 'pay-1',
            type: 'warning',
            title: 'Overdue Payments',
            body: `${latePayments} invoices are overdue.`,
            metric: `${latePayments}`,
            trend: 'down'
          });
        }
      }
    } catch (e) {
      this.logger.error(e);
    }

    this.insightsCache.set(cacheKey, { data: insights, timestamp: Date.now() });
    return insights;
  }

  async getSuggestions(organizationId: string, userId: string, context: string, lang: string) {
    const l = lang?.toLowerCase().startsWith('uz') ? 'uz' : lang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    
    const prompts = {
      uz: {
        '/attendance': ['Bugun kimlar kelmadi?', 'Davomat statistikasini ko\'rsat', 'O\'tgan haftadagi davomat qanday?'],
        '/payments': ['Qarzdor talabalar ro\'yxati', 'Bu oy qancha to\'lov tushdi?', 'Kechikkan to\'lovlar haqida ma\'lumot'],
        '/students': ['Yangi talabalar ro\'yxati', 'Talabalar soni qancha?', 'Eng faol talabalar'],
        'default': ['Tashkilot statistikasi', 'Bugungi asosiy vazifalar', 'Tizim qanday ishlaydi?']
      },
      en: {
        '/attendance': ['Who is absent today?', 'Show attendance stats', 'How was attendance last week?'],
        '/payments': ['List of students with debt', 'How much was paid this month?', 'Info on overdue payments'],
        '/students': ['List of new students', 'How many students do we have?', 'Most active students'],
        'default': ['Organization stats', 'Main tasks for today', 'How does the system work?']
      },
      ru: {
        '/attendance': ['Кто сегодня отсутствует?', 'Показать статистику посещаемости', 'Какая посещаемость была на прошлой неделе?'],
        '/payments': ['Список студентов с долгами', 'Сколько оплатили в этом месяце?', 'Информация о просроченных платежах'],
        '/students': ['Список новых студентов', 'Сколько у нас студентов?', 'Самые активные студенты'],
        'default': ['Статистика организации', 'Главные задачи на сегодня', 'Как работает система?']
      }
    };
    
    return prompts[l as keyof typeof prompts][context as keyof typeof prompts['uz']] || prompts[l as keyof typeof prompts]['default'];
  }

  private async resolveOwnedConversationId(
    organizationId: string,
    userId: string,
    conversationId?: string,
    fallbackTitle?: string,
  ): Promise<string> {
    if (!conversationId) {
      const conv = await this.createConversation(
        organizationId,
        userId,
        fallbackTitle ?? 'New conversation',
      );
      return conv.id;
    }
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, organizationId, createdBy: userId },
      select: { id: true },
    });
    if (!conv) throw new HttpException('Not found or no permission', HttpStatus.FORBIDDEN);
    return conv.id;
  }

  private async buildOrgSnapshot(organizationId: string, includeFinancials: boolean) {
    const [studentsCount, groupsCount, teachersCount] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }).catch(() => 0),
      this.prisma.group.count({ where: { organizationId } }).catch(() => 0),
      this.prisma.teacher.count({ where: { organizationId } }).catch(() => 0),
    ]);

    if (!includeFinancials) {
      return { studentsCount, groupsCount, teachersCount, financialsBlock: '' };
    }

    const [totalDebtObj, recentPayments] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId, status: 'PENDING' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      this.prisma.payment.findMany({ where: { organizationId, status: 'PAID' }, orderBy: { createdAt: 'desc' }, take: 5, include: { student: { include: { user: true } } } }).catch(() => []),
    ]);

    const totalDebt = totalDebtObj?._sum?.amount || 0;
    const recentPaymentsText = recentPayments
      .map((p) => `${p.student?.user?.firstName} ${p.student?.user?.lastName} paid ${p.amount}`)
      .join(', ');

    return {
      studentsCount,
      groupsCount,
      teachersCount,
      financialsBlock: `- Kutilayotgan to'lovlar (qarzlar): ${totalDebt} so'm\n- So'nggi to'lovlar: ${recentPaymentsText || "Hozircha yo'q"}`,
    };
  }

  async chat(
    organizationId: string, 
    userId: string, 
    message: string, 
    history: ChatHistoryItem[],
    conversationId?: string,
    includeFinancials = false,
  ): Promise<AiChatResponse> {
    
    const activeConvId = await this.resolveOwnedConversationId(
      organizationId,
      userId,
      conversationId,
      message.slice(0, 30) + '...',
    );

    // Persist user message
    await this.prisma.aiMessage.create({
      data: {
        organizationId,
        conversationId: activeConvId,
        role: 'user',
        content: message
      }
    });

    const { studentsCount, groupsCount, teachersCount, financialsBlock } =
      await this.buildOrgSnapshot(organizationId, includeFinancials);

    const client = this.getAiClient();
    const modelsToTry = [this.primaryModel, ...this.fallbackModels.filter(m => m !== this.primaryModel)];

    let assistantContent = '';

    if (client) {
      const contents = (history || []).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      const systemInstruction = `Siz M-EDU platformasining eng ilg'or, aqlli va qimmatbaho AI Copilotisiz ($20,000 darajasidagi premium yordamchi). 
Sizning vazifangiz foydalanuvchiga platformadagi biznes jarayonlarini boshqarishda yordam berish, tahliliy maslahatlar berish va ma'lumotlarni chiroyli, strukturali (Markdown, jadvallar) formatda taqdim etishdir.
Javoblaringiz doimo professionallik, xushmuomalalik va yuqori intellektni namoyon qilishi kerak.
Siz qisqa, aniq va foydali javoblar berasiz. Agar so'rov tahlil talab qilsa, chuqur xulosalar bering.

TASHKILOT HAQIDA HAQIQIY VA YANGILANGAN MA'LUMOTLAR:
- Jami talabalar: ${studentsCount} nafar
- Jami guruhlar: ${groupsCount} ta
- Jami o'qituvchilar: ${teachersCount} nafar
${financialsBlock}`;

      for (const model of modelsToTry) {
        try {
          const res = await client.models.generateContent({
            model,
            contents,
            config: { systemInstruction, temperature: 0.2 },
          });

          if (res?.text) {
            assistantContent = res.text;
            break;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Model ${model} error: ${msg}. Trying next fallback...`);
        }
      }
    }

    if (!assistantContent) {
      assistantContent = this.generateIntelligentFallback({ message, studentsCount, groupsCount, teachersCount });
    }

    // Persist assistant message
    const astMsg = await this.prisma.aiMessage.create({
      data: {
        organizationId,
        conversationId: activeConvId,
        role: 'assistant',
        content: assistantContent
      }
    });

    // Update conversation
    await this.prisma.aiConversation.update({
      where: { id: activeConvId },
      data: {
        preview: assistantContent.slice(0, 50),
        messageCount: { increment: 2 },
        updatedAt: new Date()
      }
    });

    return {
      id: astMsg.id,
      role: 'assistant',
      content: assistantContent,
      createdAt: astMsg.createdAt.toISOString(),
      conversationId: activeConvId
    };
  }

  async chatStream(
    organizationId: string, 
    userId: string, 
    message: string, 
    history: ChatHistoryItem[],
    conversationId: string | undefined,
    res: Response,
    includeFinancials = false,
  ) {
    const activeConvId = await this.resolveOwnedConversationId(
      organizationId,
      userId,
      conversationId,
      message.slice(0, 30) + '...',
    );

    await this.prisma.aiMessage.create({
      data: {
        organizationId,
        conversationId: activeConvId,
        role: 'user',
        content: message
      }
    });

    const { studentsCount, groupsCount, teachersCount, financialsBlock } =
      await this.buildOrgSnapshot(organizationId, includeFinancials);

    const client = this.getAiClient();
    
    let assistantContent = '';
    let fallbackUsed = false;
    if (client) {
      try {
        const contents = (history || []).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const systemInstruction = `Siz M-EDU platformasining eng ilg'or, aqlli va qimmatbaho AI Copilotisiz ($20,000 darajasidagi premium yordamchi). 
Sizning vazifangiz foydalanuvchiga platformadagi biznes jarayonlarini boshqarishda yordam berish, tahliliy maslahatlar berish va ma'lumotlarni chiroyli, strukturali (Markdown, jadvallar) formatda taqdim etishdir.
Javoblaringiz doimo professionallik, xushmuomalalik va yuqori intellektni namoyon qilishi kerak.
Siz qisqa, aniq va foydali javoblar berasiz. Agar so'rov tahlil talab qilsa, chuqur xulosalar bering.

TASHKILOT HAQIDA HAQIQIY VA YANGILANGAN MA'LUMOTLAR:
- Jami talabalar: ${studentsCount} nafar
- Jami guruhlar: ${groupsCount} ta
- Jami o'qituvchilar: ${teachersCount} nafar
${financialsBlock}`;

        const result = await client.models.generateContentStream({
          model: this.primaryModel,
          contents,
          config: { systemInstruction, temperature: 0.2 },
        });

        for await (const chunk of result.stream) {
          if (chunk.text) {
            assistantContent += chunk.text;
            res.write(`event: delta\ndata: ${JSON.stringify({ content: chunk.text })}\n\n`);
          }
        }
      } catch (err: unknown) {
        this.logger.error(err);
        fallbackUsed = true;
      }
    } else {
      fallbackUsed = true;
    }

    if (fallbackUsed || !assistantContent) {
      assistantContent = this.generateIntelligentFallback({ message, studentsCount, groupsCount, teachersCount });
      res.write(`event: delta\ndata: ${JSON.stringify({ content: assistantContent })}\n\n`);
    }

    const astMsg = await this.prisma.aiMessage.create({
      data: {
        organizationId,
        conversationId: activeConvId,
        role: 'assistant',
        content: assistantContent
      }
    });

    await this.prisma.aiConversation.update({
      where: { id: activeConvId },
      data: {
        preview: assistantContent.slice(0, 50),
        messageCount: { increment: 2 },
        updatedAt: new Date()
      }
    });

    res.write(`event: done\ndata: ${JSON.stringify({ conversationId: activeConvId, messageId: astMsg.id })}\n\n`);
    res.end();
  }

  async importConversations(organizationId: string, userId: string, data: any) {
    if (!data || !data.conversations || !Array.isArray(data.conversations)) {
      return { success: false };
    }
    
    for (const conv of data.conversations) {
      const newConv = await this.prisma.aiConversation.create({
        data: {
          organizationId,
          createdBy: userId,
          title: conv.title || 'Imported conversation',
          preview: '',
          messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0
        }
      });
      
      if (Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          await this.prisma.aiMessage.create({
            data: {
              organizationId,
              conversationId: newConv.id,
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content || ''
            }
          });
        }
      }
    }
    
    return { success: true };
  }

  private generateIntelligentFallback(ctx: {
    message: string;
    studentsCount: number;
    groupsCount: number;
    teachersCount: number;
  }): string {
    const raw = ctx.message.trim().toLowerCase();

    if (/^(salom|assalomu|hello|hi|qale|qalaysiz|qandaysiz|kim siz|kim bu)/i.test(raw)) {
      return "Salom! Men Amirjon Iskandarov tomonidan yaratilgan M-EDU AI Copilotman. Men M-EDU platformasi bo'yicha yordam beraman. Sizga nimada yordam bera olaman?";
    }

    if (/(talaba|o'quvchi|student)/i.test(raw)) {
      return `Tashkilotingizda jami ${ctx.studentsCount} nafar talaba ro'yxatga olingan.`;
    }

    if (/(guruh|group)/i.test(raw)) {
      return `Tashkilotingizda hozirda ${ctx.groupsCount} ta guruh faoliyat yuritmoqda.`;
    }

    return `Kechirasiz, sun'iy intellekt (Gemini) tarmog'iga ulanish yo'q. Shunday bo'lsa ham, bazangiz ishlayapti: Tashkilotda jami ${ctx.studentsCount} nafar talaba va ${ctx.groupsCount} ta guruh mavjud.`;
  }
}
