/**
 * Analytics DTOs for the face recognition dashboard.
 * All data comes from real database queries — no mock data.
 */

export interface FaceAnalyticsOverviewDto {
  /** Total enrolled students */
  totalEnrolled: number;
  /** Currently active enrollments */
  activeEnrollments: number;
  /** Total recognition sessions */
  totalSessions: number;
  /** Total recognition attempts */
  totalAttempts: number;
  /** Recognition success rate (0-100) */
  recognitionSuccessRate: number;
  /** Liveness pass rate (0-100) */
  livenessPassRate: number;
  /** Average processing latency in ms */
  averageLatencyMs: number;
  /** Active devices */
  activeDevices: number;
  /** Attendance records created today */
  todayAttendance: number;
}

export interface RecognitionTrendDto {
  date: string;
  attempts: number;
  successful: number;
  failed: number;
  uncertain: number;
}

export interface DeviceActivityDto {
  deviceId: string;
  deviceName: string;
  sessionCount: number;
  lastSeenAt: string;
  status: string;
  uptime: number;
}

export interface AnalyticsResponseDto {
  overview: FaceAnalyticsOverviewDto;
  recognitionTrend: RecognitionTrendDto[];
  deviceActivity: DeviceActivityDto[];
  topGroups: Array<{
    groupId: string;
    groupName: string;
    recognitionCount: number;
    attendanceRate: number;
  }>;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  failureBreakdown: {
    qualityFailures: number;
    livenessFailures: number;
    noMatchFound: number;
    engineErrors: number;
  };
}
