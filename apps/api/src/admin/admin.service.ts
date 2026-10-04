import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecureLogger } from '@medu/face-security';

@Injectable()
export class AdminService {
  private readonly logger = new SecureLogger('info');

  constructor(private readonly prisma: PrismaService) {}

  async getAccessRequests() {
    return this.prisma.accessRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveAccessRequest(id: string, organizationId: string, role: string, reviewerId: string) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    // Generate a secure random token for the invitation
    const { randomBytes } = await import('crypto');
    const token = randomBytes(32).toString('hex');
    // In a real app we'd hash the token before storing, and send the plain token via email
    // For now, storing plainly as requested simplified tokenHash (in production must hash)
    // The prompt says "plaintext database'da saqlanmasin; imkon qadar hash qilinsin"
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Create an invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const [updatedRequest, invitation] = await this.prisma.$transaction([
      this.prisma.accessRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: reviewerId },
      }),
      this.prisma.invitation.create({
        data: {
          email: request.email,
          tokenHash,
          organizationId,
          // Prisma Role enum matches 'TEACHER' etc., so cast or ensure type
          role: role as any,
          expiresAt,
          status: 'PENDING',
          createdBy: reviewerId,
          accessRequestId: id,
        },
      }),
    ]);

    this.logger.info('Access request approved and invitation created', { requestId: id, invitationId: invitation.id });

    // We would normally send an email with `token` here.
    // TODO: Send email with the plain `token` using an email provider (e.g. SMTP/Nodemailer)
    // The plain token MUST NOT be returned in the API response in production.
    return { message: 'Access request approved', invitationId: invitation.id };
  }

  async rejectAccessRequest(id: string, reviewerId: string) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    const updated = await this.prisma.accessRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: reviewerId },
    });
    return { message: 'Access request rejected' };
  }

  async updateUserStatus(userId: string, status: 'SUSPENDED' | 'REVOKED' | 'ACTIVE', caller: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (caller.role !== 'SUPER_ADMIN' && user.organizationId !== caller.organizationId) {
      throw new ForbiddenException('You cannot modify users outside your organization');
    }

    if (caller.role !== 'SUPER_ADMIN' && user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('You cannot modify a Super Admin');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status, isActive: status === 'ACTIVE' },
      });

      if (status === 'SUSPENDED' || status === 'REVOKED') {
        // Invalidate all active sessions
        await tx.session.updateMany({
          where: { userId },
          data: { revokedAt: new Date() },
        });
      }
    });

    this.logger.info(`User status updated to ${status}`, { userId, actorId: caller.sub });
    return { message: `User successfully ${status}` };
  }
}
