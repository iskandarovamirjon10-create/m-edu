import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { PrismaService } from '../../../prisma/prisma.service';

function getTashkentStartOfDay(): Date {
  const now = new Date();
  const tashkentOffsetMs = 5 * 60 * 60 * 1000;
  const tashkentTime = new Date(now.getTime() + tashkentOffsetMs);
  const year = tashkentTime.getUTCFullYear();
  const month = tashkentTime.getUTCMonth();
  const day = tashkentTime.getUTCDate();
  return new Date(Date.UTC(year, month, day, -5, 0, 0));
}

export function createBiometricsTools(prisma: PrismaService): AiToolDefinition[] {
  return [
    {
      name: 'biometrics.status',
      description:
        "Kameralar, Face ID bazasi va biometrik turniket tizimining hozirgi operatsion holati va statistikasi.",
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.BIOMETRICS_READ,
      execute: async (_input, context) => {
        const today = getTashkentStartOfDay();

        const [cameras, totalEnrolledFaces, todayEventsCount] = await Promise.all([
          prisma.camera.findMany({
            where: { organizationId: context.organizationId },
            select: { id: true, name: true, status: true, host: true, location: true },
          }),
          prisma.faceEnrollment.count({
            where: { organizationId: context.organizationId, status: 'ACTIVE' },
          }),
          prisma.cameraAttendanceEvent.count({
            where: {
              organizationId: context.organizationId,
              date: { gte: today },
            },
          }),
        ]);

        const onlineCount = cameras.filter((c) => c.status === 'ACTIVE' || c.status === 'ONLINE').length;

        return {
          totalCameras: cameras.length,
          onlineCameras: onlineCount,
          offlineCameras: cameras.length - onlineCount,
          enrolledFaceProfiles: totalEnrolledFaces,
          todayFaceAttendanceScans: todayEventsCount,
          cameras: cameras.map((c) => ({
            name: c.name,
            status: c.status,
            location: c.location || 'Bosh kirish',
          })),
        };
      },
    },
    {
      name: 'biometrics.recent_events',
      description:
        "Face ID va kameralar orqali qayd etilgan so'nggi davomat voqealari va tanish natijalari.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.BIOMETRICS_READ,
      execute: async (input: { limit?: number }, context) => {
        const events = await prisma.cameraAttendanceEvent.findMany({
          where: { organizationId: context.organizationId },
          include: {
            camera: { select: { name: true, location: true } },
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
          take: input.limit ?? 10,
        });

        return {
          totalEvents: events.length,
          events: (events as any[]).map((ev: any) => ({
            id: ev.id,
            studentName: ev.student?.user
              ? `${ev.student.user.firstName} ${ev.student.user.lastName}`.trim()
              : 'Nomaʼlum',
            cameraName: ev.camera?.name || 'Kamera',
            location: ev.camera?.location || 'Turniket',
            confidence: ev.confidence ? Number((Number(ev.confidence) * 100).toFixed(1)) : null,
            decision: ev.decision || 'MARKED_PRESENT',
            recognizedAt: ev.recognizedAt || ev.date,
          })),
        };
      },
    },
  ];
}
