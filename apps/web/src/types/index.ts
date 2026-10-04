/**
 * Public entrypoint for M-EDU frontend domain types and API contracts.
 * Organized strictly by domain with zero collisions.
 */

// 1. Common / Shared
export * from './common';

// 2. Identity, Auth & Users
export * from './auth';
export type { UserFilters } from './users';

// 3. Students & Academics
export * from './students';
export * from './academics';

// 4. Attendance
export * from './attendance';

// 5. Finance & Invoices
export * from './finance';
export * from './invoices';

// 6. Leads & CRM Analytics
export * from './leads';
export * from './crm-analytics';

// 7. Face Recognition & Biometrics
export * from './face';

// 8. Cameras
export * from './cameras';

// 9. Library
export * from './library';

// 10. HR & Payroll
export * from './hr';
export * from './payroll';

// 11. Exams & Certificates
export * from './exams';
export * from './certificates';

// 12. Inventory
export * from './inventory';

// 13. System Audit & Compliance
export * from './audit';

// 14. Universal Search & Relationship Graph
export * from './search-graph';

// 15. Data Quality
export * from './data-quality';

// 16. Workflows & Automation
export * from './workflows';
export * from './automation';

// 17. Documents
export * from './documents';

// 18. Resources & Rooms
export * from './resources';

// 19. Data Import / Export
export * from './imports';

// 20. Early Warnings, Academic Risk & Workload
export * from './warnings';
export * from './risk';
export * from './workload';

// 21. Forecasting
export * from './forecasting';

// 22. Multi-Branch Operations
export * from './branches';

// 23. Chat & Messaging
export * from './chat';

// 24. Parent Portal
export * from './parent';

// 25. Feature Flags
export * from './feature-flags';

// 26. System Health & Observability
export * from './system-health';

// 27. Security Center
export * from './security';

// 28. Notifications
export * from './notifications';

// 29. Executive Dashboard
export * from './dashboard';

// 30. Data Governance
export type {
  DataGovernancePolicy,
  ExportLog,
  DataAccessLog,
  ExportStats,
  RetentionCheckResult,
} from './governance';

// 31. AI Copilot Protocol & View Models
export * from './ai';
