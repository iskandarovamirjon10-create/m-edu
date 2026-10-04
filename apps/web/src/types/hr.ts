/**
 * Human Resources, employees, leave requests, and payroll records.
 */

import type { User } from './auth';

export type ContractType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type LeaveType = 'SICK' | 'VACATION' | 'PERSONAL' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Employee {
  id: string;
  organizationId: string;
  userId: string;
  employeeNumber?: string | null;
  position: string;
  department?: string | null;
  contractType: ContractType;
  salary: number;
  hireDate: string;
  isActive: boolean;
  bankAccount?: string | null;
  taxId?: string | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  rejectionReason?: string;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
  tax?: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: string;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  totalPayroll: number;
}
