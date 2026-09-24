/**
 * Student directory port — adapter for retrieving student information.
 * This decouples the face module from any specific student database schema.
 * In a multi-platform integration, this would call the education platform's API.
 */

export interface StudentInfo {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  studentId: string | null;
  isActive: boolean;
}

export interface StudentGroupMembership {
  studentId: string;
  groupId: string;
  groupName: string;
  isActive: boolean;
}

export interface StudentDirectoryPort {
  /**
   * Get student by ID, scoped to organization.
   */
  getStudent(organizationId: string, studentId: string): Promise<StudentInfo | null>;

  /**
   * Check if a student is a member of a specific group.
   */
  isStudentInGroup(
    organizationId: string,
    studentId: string,
    groupId: string
  ): Promise<boolean>;

  /**
   * Get all group memberships for a student.
   */
  getStudentGroups(
    organizationId: string,
    studentId: string
  ): Promise<StudentGroupMembership[]>;

  /**
   * Check if a student is active.
   */
  isStudentActive(organizationId: string, studentId: string): Promise<boolean>;

  /**
   * List students in a group (for batch enrollment operations).
   */
  listStudentsInGroup(
    organizationId: string,
    groupId: string
  ): Promise<StudentInfo[]>;
}
