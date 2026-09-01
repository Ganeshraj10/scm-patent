import {
  ROLE_PERMISSIONS,
  hasPermission,
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUsersByRole,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserRole,
  deleteUser,
  resetUserRegistry,
  getMappedStudentId,
  DEMO_ACCOUNTS,
} from '../lib/services/userService';
import { getStudentPatentRecords } from '../lib/services/datasetService';
import type { UserRole, Permission, UserProfile } from '../types';

describe('Stage 3: User Management, Roles & Role-Based Access Control (RBAC)', () => {
  beforeEach(() => {
    resetUserRegistry();
  });

  // ─── 1. Role Definitions & Permissions Matrix ───────────────────────────────
  test('1. Enforces exactly three application roles: student, instructor, admin', () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as UserRole[];
    expect(roles.sort()).toEqual(['admin', 'instructor', 'student']);
  });

  test('2. Verifies student permissions boundary (self-telemetry only)', () => {
    expect(hasPermission('student', 'VIEW_OWN_DASHBOARD')).toBe(true);
    expect(hasPermission('student', 'VIEW_OWN_COURSEWORK')).toBe(true);
    expect(hasPermission('student', 'VIEW_OWN_EXAMS')).toBe(true);
    expect(hasPermission('student', 'VIEW_OWN_RESULTS')).toBe(true);
    expect(hasPermission('student', 'TAKE_EXAM')).toBe(true);

    // Student forbidden from instructor/admin areas
    expect(hasPermission('student', 'VIEW_INSTRUCTOR_DASHBOARD')).toBe(false);
    expect(hasPermission('student', 'VIEW_REVIEW_QUEUE')).toBe(false);
    expect(hasPermission('student', 'PERFORM_HUMAN_REVIEW')).toBe(false);
    expect(hasPermission('student', 'VIEW_ADMIN_DASHBOARD')).toBe(false);
    expect(hasPermission('student', 'MANAGE_USERS')).toBe(false);
    expect(hasPermission('student', 'TOGGLE_USER_STATUS')).toBe(false);
  });

  test('3. Verifies instructor permissions boundary (reviews & exams, not admin)', () => {
    expect(hasPermission('instructor', 'VIEW_INSTRUCTOR_DASHBOARD')).toBe(true);
    expect(hasPermission('instructor', 'VIEW_ASSIGNED_STUDENTS')).toBe(true);
    expect(hasPermission('instructor', 'VIEW_STUDENT_COURSEWORK')).toBe(true);
    expect(hasPermission('instructor', 'VIEW_STUDENT_SESSIONS')).toBe(true);
    expect(hasPermission('instructor', 'VIEW_BEHAVIORAL_ANALYSIS')).toBe(true);
    expect(hasPermission('instructor', 'VIEW_REVIEW_QUEUE')).toBe(true);
    expect(hasPermission('instructor', 'PERFORM_HUMAN_REVIEW')).toBe(true);

    // Instructor forbidden from platform admin operations
    expect(hasPermission('instructor', 'VIEW_ADMIN_DASHBOARD')).toBe(false);
    expect(hasPermission('instructor', 'MANAGE_USERS')).toBe(false);
    expect(hasPermission('instructor', 'CHANGE_USER_ROLE')).toBe(false);
    expect(hasPermission('instructor', 'TOGGLE_USER_STATUS')).toBe(false);
  });

  test('4. Verifies admin permissions boundary (user administration & system oversight)', () => {
    expect(hasPermission('admin', 'VIEW_ADMIN_DASHBOARD')).toBe(true);
    expect(hasPermission('admin', 'MANAGE_USERS')).toBe(true);
    expect(hasPermission('admin', 'CHANGE_USER_ROLE')).toBe(true);
    expect(hasPermission('admin', 'TOGGLE_USER_STATUS')).toBe(true);
    expect(hasPermission('admin', 'VIEW_SYSTEM_STATUS')).toBe(true);
    expect(hasPermission('admin', 'MANAGE_APP_SETTINGS')).toBe(true);
  });

  // ─── 2. Student Identity Mapping & Data Isolation ──────────────────────────
  test('5. Maps authenticated student user IDs to dataset student IDs accurately', () => {
    expect(getMappedStudentId('usr-demo-student')).toBe('S001');
    expect(getMappedStudentId('usr-s002')).toBe('S002');
    expect(getMappedStudentId('usr-s003')).toBe('S003');

    const demoStudent = getUserByEmail('student_demo@examguard.io');
    expect(demoStudent).toBeDefined();
    expect(getMappedStudentId(demoStudent!)).toBe('S001');
  });

  test('6. Student data isolation: logged-in student accesses only own mapped dataset records', () => {
    const studentUser = getUserById('usr-demo-student')!;
    const mappedStudentId = getMappedStudentId(studentUser);
    expect(mappedStudentId).toBe('S001');

    const studentRecords = getStudentPatentRecords(mappedStudentId);
    expect(studentRecords.length).toBe(12); // 8 low-stakes + 4 graded
    // Verify all returned records belong strictly to S001
    const foreignRecords = studentRecords.filter((r) => r.student_id !== 'S001');
    expect(foreignRecords.length).toBe(0);
  });

  // ─── 3. User Management Operations (Admin) ─────────────────────────────────
  test('7. Admin user CRUD, status toggling, and role modification work cleanly', () => {
    // 7a. Create user
    const newUser = createUser({
      name: 'Dr. Marcus Vance',
      email: 'marcus.vance@university.edu',
      role: 'instructor',
      department: 'Computer Science',
    });
    expect(newUser.id).toBeDefined();
    expect(newUser.name).toBe('Dr. Marcus Vance');
    expect(newUser.role).toBe('instructor');
    expect(newUser.status).toBe('active');

    // 7b. Edit user
    const updatedUser = updateUser(newUser.id, {
      name: 'Dr. Marcus Vance, PhD',
      department: 'Cybersecurity',
    });
    expect(updatedUser.name).toBe('Dr. Marcus Vance, PhD');
    expect(updatedUser.department).toBe('Cybersecurity');

    // 7c. Toggle status
    const disabledUser = toggleUserStatus(newUser.id);
    expect(disabledUser.status).toBe('disabled');
    const enabledUser = toggleUserStatus(newUser.id);
    expect(enabledUser.status).toBe('active');

    // 7d. Change role
    const promotedUser = changeUserRole(newUser.id, 'admin');
    expect(promotedUser.role).toBe('admin');
  });

  test('8. Filters and searches user directory accurately', () => {
    const all = getAllUsers();
    expect(all.length).toBeGreaterThanOrEqual(10);

    const students = getAllUsers({ role: 'student' });
    expect(students.every((u: UserProfile) => u.role === 'student')).toBe(true);

    const admins = getAllUsers({ role: 'admin' });
    expect(admins.length).toBeGreaterThanOrEqual(1);

    const searchResults = getAllUsers({ search: 'Alex Chen' });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].email).toBe('student_demo@examguard.io');
  });

  // ─── 4. Demo Accounts Provisioning ─────────────────────────────────────────
  test('9. Demo accounts configuration contains Student, Instructor, and Admin roles', () => {
    expect(DEMO_ACCOUNTS.length).toBe(3);
    const demoRoles = DEMO_ACCOUNTS.map((d) => d.role);
    expect(demoRoles).toContain('student');
    expect(demoRoles).toContain('instructor');
    expect(demoRoles).toContain('admin');

    const studentDemo = DEMO_ACCOUNTS.find((d) => d.role === 'student')!;
    expect(studentDemo.mappedStudentId).toBe('S001');
  });

  // ─── 5. Route Authorization Simulation ─────────────────────────────────────
  test('10. Simulates route access control decision logic', () => {
    function isRouteAllowed(role: UserRole, pathname: string): boolean {
      if (pathname.startsWith('/admin')) {
        return role === 'admin';
      }
      if (pathname.startsWith('/instructor')) {
        return role === 'instructor' || role === 'admin';
      }
      if (pathname.startsWith('/student')) {
        return role === 'student' || role === 'admin';
      }
      return true;
    }

    // Student route permissions
    expect(isRouteAllowed('student', '/student/dashboard')).toBe(true);
    expect(isRouteAllowed('student', '/instructor/dashboard')).toBe(false);
    expect(isRouteAllowed('student', '/instructor/analysis')).toBe(false);
    expect(isRouteAllowed('student', '/admin/dashboard')).toBe(false);
    expect(isRouteAllowed('student', '/admin/users')).toBe(false);

    // Instructor route permissions
    expect(isRouteAllowed('instructor', '/instructor/dashboard')).toBe(true);
    expect(isRouteAllowed('instructor', '/instructor/analysis')).toBe(true);
    expect(isRouteAllowed('instructor', '/instructor/alerts')).toBe(true);
    expect(isRouteAllowed('instructor', '/admin/dashboard')).toBe(false);
    expect(isRouteAllowed('instructor', '/admin/users')).toBe(false);

    // Admin route permissions
    expect(isRouteAllowed('admin', '/admin/dashboard')).toBe(true);
    expect(isRouteAllowed('admin', '/admin/users')).toBe(true);
    expect(isRouteAllowed('admin', '/admin/status')).toBe(true);
    expect(isRouteAllowed('admin', '/instructor/dashboard')).toBe(true);
  });
});
