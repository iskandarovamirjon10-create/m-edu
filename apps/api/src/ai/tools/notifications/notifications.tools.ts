import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { PrismaService } from '../../../prisma/prisma.service';

const MAX_RECIPIENTS = 5_000;

const broadcastSchema = z.object({
  audience: z
    .enum(['ALL', 'GROUP', 'DEBTORS'])
    .describe(
      'ALL = every active student/parent account in the organization, GROUP = active members of groupId, DEBTORS = students with overdue invoices.',
    ),
  groupId: z
    .string()
    .uuid()
    .optional()
    .describe('Required when audience is GROUP.'),
  title: z.string().min(1).max(140),
  message: z.string().min(1).max(1000),
});

type BroadcastInput = z.infer<typeof broadcastSchema>;

interface BroadcastResult {
  channel: 'platform';
  audience: BroadcastInput['audience'];
  recipientGroup: string;
  recipientCount: number;
  title: string;
  message: string;
  sentAt: string;
}

/**
 * Real in-app broadcast.
 *
 * The previous implementation only *described* a broadcast and then failed
 * because no `broadcast.send` tool existed in the registry. This tool actually
 * resolves the audience inside the tenant, writes the notifications and keeps
 * an audit trail in `CommunicationHistory`.
 *
 * It is a write tool, so the gateway always parks it as a pending action and a
 * human must confirm before anything is delivered.
 */
export function createNotificationsTools(prisma: PrismaService): AiToolDefinition[] {
  return [
    {
      name: 'notifications.broadcast',
      description:
        'Send an in-app notification to the students (and parent accounts that have a ' +
        'platform user) of the current organization. Requires user confirmation: the ' +
        'platform shows the exact audience and text before anything is delivered. ' +
        'Never invent recipient names — report the count returned.',
      inputSchema: broadcastSchema,
      riskLevel: AiToolRiskLevel.HIGH,
      requiresConfirmation: true,
      permission: AiPermission.NOTIFICATIONS_WRITE,
      execute: async (
        input: BroadcastInput,
        context,
      ): Promise<BroadcastResult> => {
        const organizationId = context.organizationId;

        let userIds: string[] = [];
        let recipientGroup = "Barcha o'quvchilar";

        if (input.audience === 'GROUP') {
          if (!input.groupId) {
            throw new Error('groupId is required for a group broadcast');
          }

          const group = await prisma.group.findFirst({
            where: { id: input.groupId, organizationId },
            select: { name: true },
          });
          if (!group) {
            throw new Error('Group not found in this organization');
          }
          recipientGroup = `Guruh: ${group.name}`;

          const enrollments = await prisma.studentGroup.findMany({
            where: {
              groupId: input.groupId,
              organizationId,
              isActive: true,
            },
            select: { student: { select: { userId: true } } },
            take: MAX_RECIPIENTS,
          });
          userIds = enrollments
            .map((row) => row.student?.userId)
            .filter((id): id is string => Boolean(id));
        } else if (input.audience === 'DEBTORS') {
          recipientGroup = "Qarzdor o'quvchilar";

          const invoices = await prisma.invoice.findMany({
            where: {
              organizationId,
              status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
            },
            select: { student: { select: { userId: true } } },
            take: MAX_RECIPIENTS,
          });
          userIds = invoices
            .map((row) => row.student?.userId)
            .filter((id): id is string => Boolean(id));
        } else {
          const users = await prisma.user.findMany({
            where: {
              organizationId,
              role: { in: ['STUDENT', 'PARENT'] as never[] },
            },
            select: { id: true },
            take: MAX_RECIPIENTS,
          });
          userIds = users.map((user) => user.id);
        }

        // De-duplicate: a student with three overdue invoices is one person.
        const uniqueUserIds = [...new Set(userIds)];

        if (uniqueUserIds.length > 0) {
          await prisma.notification.createMany({
            data: uniqueUserIds.map((userId) => ({
              organizationId,
              userId,
              title: input.title,
              message: input.message,
              type: 'info',
            })),
          });
        }

        const sentAt = new Date().toISOString();

        await prisma.communicationHistory
          .create({
            data: {
              organizationId,
              entityType: 'BROADCAST',
              entityId: context.userId,
              channel: 'IN_APP',
              direction: 'OUTBOUND',
              subject: input.title,
              content: input.message,
              status: uniqueUserIds.length > 0 ? 'SENT' : 'SKIPPED',
              metadata: {
                audience: input.audience,
                groupId: input.groupId ?? null,
                recipients: uniqueUserIds.length,
                aiAction: true,
              },
            },
          })
          .catch(() => undefined);

        return {
          channel: 'platform',
          audience: input.audience,
          recipientGroup,
          recipientCount: uniqueUserIds.length,
          title: input.title,
          message: input.message,
          sentAt,
        };
      },
    },
  ];
}
