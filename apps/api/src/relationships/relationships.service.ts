import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type EntityType = 'STUDENT' | 'TEACHER' | 'GROUP' | 'COURSE' | 'LEAD' | 'PAYMENT' | 'EMPLOYEE';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  subLabel?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: string;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootType: string;
  rootId: string;
}

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraph(
    orgId: string,
    entityType: string,
    entityId: string,
    depth: number = 2,
  ): Promise<GraphResult> {
    const upper = entityType.toUpperCase() as EntityType;
    const root = await this.fetchRootNode(orgId, upper, entityId);

    const nodes: GraphNode[] = [root];
    const edges: GraphEdge[] = [];
    const seen = new Set<string>([`${root.type}:${root.id}`]);

    if (depth >= 2) {
      await this.expandNode(orgId, root, seen, nodes, edges, depth);
    }

    return { nodes, edges, rootType: root.type, rootId: root.id };
  }

  // ---------------------------------------------------------------------------
  // Root
  // ---------------------------------------------------------------------------

  private async fetchRootNode(orgId: string, type: EntityType, id: string): Promise<GraphNode> {
    switch (type) {
      case 'STUDENT': {
        const s = await this.prisma.student.findFirst({
          where: { id, organizationId: orgId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (!s) throw new Error(`Student not found: ${id}`);
        return {
          id: s.id,
          type: 'STUDENT',
          label: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() || s.id,
          subLabel: s.id,
        };
      }
      case 'TEACHER': {
        const t = await this.prisma.teacher.findFirst({
          where: { id, organizationId: orgId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (!t) throw new Error(`Teacher not found: ${id}`);
        return {
          id: t.id,
          type: 'TEACHER',
          label: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim() || t.id,
          subLabel: t.id,
        };
      }
      case 'GROUP': {
        const g = await this.prisma.group.findFirst({ where: { id, organizationId: orgId } });
        if (!g) throw new Error(`Group not found: ${id}`);
        return { id: g.id, type: 'GROUP', label: g.name, subLabel: g.id };
      }
      case 'COURSE': {
        const c = await this.prisma.course.findFirst({ where: { id, organizationId: orgId } });
        if (!c) throw new Error(`Course not found: ${id}`);
        return { id: c.id, type: 'COURSE', label: c.name, subLabel: c.id };
      }
      case 'LEAD': {
        const l = await this.prisma.lead.findFirst({ where: { id, organizationId: orgId } });
        if (!l) throw new Error(`Lead not found: ${id}`);
        return { id: l.id, type: 'LEAD', label: `${l.firstName} ${l.lastName ?? ''}`.trim(), subLabel: l.stage };
      }
      case 'PAYMENT': {
        const p = await this.prisma.payment.findFirst({ where: { id, organizationId: orgId } });
        if (!p) throw new Error(`Payment not found: ${id}`);
        return { id: p.id, type: 'PAYMENT', label: `Payment ${p.amount}`, subLabel: p.status };
      }
      case 'EMPLOYEE': {
        const e = await this.prisma.employee.findFirst({
          where: { id, organizationId: orgId },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (!e) throw new Error(`Employee not found: ${id}`);
        return {
          id: e.id,
          type: 'EMPLOYEE',
          label: `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim() || e.id,
          subLabel: e.position ?? undefined,
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Expansion
  // ---------------------------------------------------------------------------

  private async expandNode(
    orgId: string,
    node: GraphNode,
    seen: Set<string>,
    nodes: GraphNode[],
    edges: GraphEdge[],
    remainingDepth: number,
  ): Promise<void> {
    switch (node.type) {
      case 'STUDENT':
        await this.expandStudent(orgId, node, seen, nodes, edges, remainingDepth);
        break;
      case 'TEACHER':
        await this.expandTeacher(orgId, node, seen, nodes, edges, remainingDepth);
        break;
      case 'GROUP':
        await this.expandGroup(orgId, node, seen, nodes, edges, remainingDepth);
        break;
      case 'COURSE':
        await this.expandCourse(orgId, node, seen, nodes, edges, remainingDepth);
        break;
    }
  }

  private pushChild(
    node: GraphNode,
    seen: Set<string>,
    nodes: GraphNode[],
    parent: GraphNode,
    edges: GraphEdge[],
    label: string,
    type: string,
  ): boolean {
    const key = `${node.type}:${node.id}`;
    if (seen.has(key)) {
      // edge from parent to this existing node may already exist; just ensure
      edges.push({ from: parent.id, to: node.id, label, type });
      return false;
    }
    seen.add(key);
    nodes.push(node);
    edges.push({ from: parent.id, to: node.id, label, type });
    return true;
  }

  // ----- STUDENT -----
  private async expandStudent(
    orgId: string, parent: GraphNode, seen: Set<string>, nodes: GraphNode[], edges: GraphEdge[], depth: number,
  ) {
    // groups via StudentGroup
    const enrollments = await this.prisma.studentGroup.findMany({
      where: { studentId: parent.id, isActive: true },
      include: { group: true },
    });
    for (const e of enrollments) {
      if (!e.group) continue;
      const child: GraphNode = { id: e.group.id, type: 'GROUP', label: e.group.name };
      const isNew = this.pushChild(child, seen, nodes, parent, edges, 'enrolled in', 'ENROLLMENT');
      if (isNew && depth > 2) await this.expandNode(orgId, child, seen, nodes, edges, depth - 1);
    }

    // payments
    const payments = await this.prisma.payment.findMany({
      where: { studentId: parent.id, organizationId: orgId },
      take: 50,
    });
    for (const p of payments) {
      const child: GraphNode = { id: p.id, type: 'PAYMENT', label: `${p.amount}`, subLabel: p.status };
      this.pushChild(child, seen, nodes, parent, edges, 'paid', 'PAYMENT');
    }

    // attendance
    const attendance = await this.prisma.attendance.findMany({
      where: { studentId: parent.id, organizationId: orgId },
      take: 25,
      orderBy: { date: 'desc' },
    });
    for (const a of attendance) {
      const child: GraphNode = {
        id: a.id,
        type: 'ATTENDANCE',
        label: new Date(a.date).toLocaleDateString(),
        subLabel: a.status,
      };
      this.pushChild(child, seen, nodes, parent, edges, 'attended', 'ATTENDANCE');
    }
  }

  // ----- TEACHER -----
  private async expandTeacher(
    orgId: string, parent: GraphNode, seen: Set<string>, nodes: GraphNode[], edges: GraphEdge[], depth: number,
  ) {
    const groups = await this.prisma.group.findMany({
      where: { teacherId: parent.id, organizationId: orgId },
    });
    for (const g of groups) {
      const child: GraphNode = { id: g.id, type: 'GROUP', label: g.name };
      const isNew = this.pushChild(child, seen, nodes, parent, edges, 'teaches', 'TEACHES');
      if (isNew && depth > 2) await this.expandNode(orgId, child, seen, nodes, edges, depth - 1);
    }

    // courses: derive from groups
    const courseIds = Array.from(new Set(groups.map(g => g.courseId).filter(Boolean))) as string[];
    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds }, organizationId: orgId },
      });
      for (const c of courses) {
        const child: GraphNode = { id: c.id, type: 'COURSE', label: c.name };
        this.pushChild(child, seen, nodes, parent, edges, 'instructs', 'INSTRUCTS');
      }
    }
  }

  // ----- GROUP -----
  private async expandGroup(
    orgId: string, parent: GraphNode, seen: Set<string>, nodes: GraphNode[], edges: GraphEdge[], depth: number,
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id: parent.id, organizationId: orgId },
    });
    if (!group) return;

    if (group.teacherId) {
      const t = await this.prisma.teacher.findFirst({
        where: { id: group.teacherId, organizationId: orgId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (t) {
        const child: GraphNode = {
          id: t.id,
          type: 'TEACHER',
          label: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim() || t.id,
        };
        const isNew = this.pushChild(child, seen, nodes, parent, edges, 'taught by', 'TAUGHT_BY');
        if (isNew && depth > 2) await this.expandNode(orgId, child, seen, nodes, edges, depth - 1);
      }
    }

    if (group.courseId) {
      const c = await this.prisma.course.findFirst({
        where: { id: group.courseId, organizationId: orgId },
      });
      if (c) {
        const child: GraphNode = { id: c.id, type: 'COURSE', label: c.name };
        const isNew = this.pushChild(child, seen, nodes, parent, edges, 'part of', 'PART_OF');
        if (isNew && depth > 2) await this.expandNode(orgId, child, seen, nodes, edges, depth - 1);
      }
    }

    const enrollments = await this.prisma.studentGroup.findMany({
      where: { groupId: parent.id, isActive: true },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      take: 100,
    });
    for (const e of enrollments) {
      if (!e.student) continue;
      const child: GraphNode = {
        id: e.student.id,
        type: 'STUDENT',
        label: `${e.student.user?.firstName ?? ''} ${e.student.user?.lastName ?? ''}`.trim() || e.student.id,
      };
      this.pushChild(child, seen, nodes, parent, edges, 'has student', 'ENROLLED');
    }
  }

  // ----- COURSE -----
  private async expandCourse(
    orgId: string, parent: GraphNode, seen: Set<string>, nodes: GraphNode[], edges: GraphEdge[], depth: number,
  ) {
    const groups = await this.prisma.group.findMany({
      where: { courseId: parent.id, organizationId: orgId },
    });
    for (const g of groups) {
      const child: GraphNode = { id: g.id, type: 'GROUP', label: g.name };
      const isNew = this.pushChild(child, seen, nodes, parent, edges, 'has group', 'HAS_GROUP');
      if (isNew && depth > 2) await this.expandNode(orgId, child, seen, nodes, edges, depth - 1);
    }

    const teacherIds = Array.from(new Set(groups.map(g => g.teacherId).filter(Boolean))) as string[];
    if (teacherIds.length > 0) {
      const teachers = await this.prisma.teacher.findMany({
        where: { id: { in: teacherIds }, organizationId: orgId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      for (const t of teachers) {
        const child: GraphNode = {
          id: t.id,
          type: 'TEACHER',
          label: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim() || t.id,
        };
        this.pushChild(child, seen, nodes, parent, edges, 'taught by', 'TAUGHT_BY');
      }
    }
  }
}
