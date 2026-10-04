/**
 * Academic Risk detection and student risk factor domain models.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  factorId?: string;
  name: string;
  weight: number;
  score: number;
  evidence?: string;
  category?: 'ATTENDANCE' | 'GRADES' | 'PARTICIPATION' | 'PAYMENT' | 'BEHAVIOUR' | 'OTHER';
  description?: string;
}

export interface AcademicRisk {
  studentId: string;
  studentName: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  recommendation?: string;
  recommendations?: string[];
  score?: number;
  trend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
  lastEvaluatedAt?: string;
  previousLevel?: RiskLevel;
}

/**
 * Shape returned by GET /academic-risk/summary
 */
export interface AcademicRiskSummary {
  total?: number;
  totalAtRisk?: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  byLevel?: Record<string, number>;
  trend?: { date: string; average: number }[];
  topRiskFactors?: { category: string; count: number }[];
}

export interface AcademicRiskFactor {
  factorId: string;
  name: string;
  weight: number;
  score: number;
}

export interface AcademicRiskItem {
  studentId: string;
  studentName: string;
  groupId: string | null;
  groupName: string | null;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  factors: AcademicRiskFactor[];
  lastGrade: number | null;
  attendanceRate: number;
  homeworkCompletion: number;
}
