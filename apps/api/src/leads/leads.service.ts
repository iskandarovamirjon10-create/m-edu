import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { AddLeadActivityDto, ConvertLeadDto, CreateLeadDto, UpdateLeadDto } from '../common/dto';
import { LeadQuery } from '../common/dto/query';
import { userPublicSelect } from '../common/selects/user.select';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: LeadQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.LeadWhereInput = { organizationId };

    if (query.stage) where.stage = query.stage as Prisma.LeadWhereInput['stage'];
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          _count: { select: { activities: true, followUps: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { scheduledAt: 'asc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(organizationId: string, data: CreateLeadDto) {
    await this.assertOwnerInOrg(organizationId, data.ownerId);
    return this.prisma.lead.create({
      data: {
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        source: data.source,
        notes: data.notes,
        ownerId: data.ownerId,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateLeadDto) {
    await this.findOne(organizationId, id);
    if (data.ownerId !== undefined) {
      await this.assertOwnerInOrg(organizationId, data.ownerId);
    }

    const updateData: Prisma.LeadUpdateInput = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    await this.prisma.lead.updateMany({ where: { id, organizationId }, data: updateData });
    return this.findOne(organizationId, id);
  }

  async updateStage(organizationId: string, id: string, stage: string, lostReason?: string) {
    const lead = await this.findOne(organizationId, id);
    if (lead.stage === 'WON' && stage !== 'WON') {
      throw new BadRequestException('A converted (WON) lead cannot move back to an earlier stage');
    }
    await this.prisma.lead.updateMany({
      where: { id, organizationId },
      data: { stage: stage as Prisma.LeadUpdateInput['stage'], lostReason: stage === 'LOST' ? lostReason : null },
    });
    return this.findOne(organizationId, id);
  }

  async convert(organizationId: string, id: string, data: ConvertLeadDto) {
    const lead = await this.findOne(organizationId, id);
    if (lead.stage === 'WON') throw new BadRequestException('Lead is already converted');

    const email = data.email || lead.email;
    if (!email) throw new BadRequestException('Email is required for conversion');

    const lastName = data.lastName || lead.lastName;
    if (!lastName) throw new BadRequestException('Last name is required for conversion');

    const existing = await this.prisma.user.findFirst({ where: { email, organizationId } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            organization: { connect: { id: organizationId } },
            user: {
              create: {
                organization: { connect: { id: organizationId } },
                email,
                passwordHash,
                firstName: lead.firstName,
                lastName: lastName,
                phone: lead.phone,
                role: 'STUDENT',
                settings: { create: {} },
              },
            },
          },
          include: { user: userPublicSelect },
        });

      await tx.lead.update({
        where: { id, organizationId },
        data: { stage: 'WON' },
      });

      return student;
    });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('This email is unavailable');
      }
      throw error;
    }
  }

  async addActivity(organizationId: string, id: string, data: AddLeadActivityDto) {
    await this.findOne(organizationId, id);
    return this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: data.type,
        subject: data.subject,
        description: data.description,
        outcome: data.outcome,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const lead = await this.findOne(organizationId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.leadActivity.deleteMany({ where: { leadId: id } });
      await tx.followUp.deleteMany({ where: { leadId: id } });
      await tx.lead.deleteMany({ where: { id, organizationId } });
    });
    return lead;
  }

  private async assertOwnerInOrg(organizationId: string, ownerId?: string): Promise<void> {
    if (!ownerId) return;
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, organizationId },
      select: { id: true },
    });
    if (!owner) {
      throw new BadRequestException('Owner user not found in this organization');
    }
  }
}
