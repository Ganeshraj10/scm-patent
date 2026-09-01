/**
 * ExamGuard — User Management & Role-Based Access Control (RBAC) Service
 * 
 * Stage 3: User registry, role definition, permissions matrix, and student mapping.
 * Connects authenticated users with dataset identities while keeping sensitive
 * telemetry logically separated from administrative user records.
 */

import { UserProfile, UserRole, UserStatus, Permission, UserFilterOptions, UserMutationInput } from '@/types';

// ─── Role Permissions Matrix ────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [
    'VIEW_OWN_DASHBOARD',
    'VIEW_OWN_COURSEWORK',
    'VIEW_OWN_EXAMS',
    'VIEW_OWN_RESULTS',
    'TAKE_EXAM',
  ],
  instructor: [
    'VIEW_INSTRUCTOR_DASHBOARD',
    'VIEW_ASSIGNED_STUDENTS',
    'VIEW_STUDENT_COURSEWORK',
    'VIEW_STUDENT_SESSIONS',
    'VIEW_BEHAVIORAL_ANALYSIS',
    'VIEW_REVIEW_QUEUE',
    'PERFORM_HUMAN_REVIEW',
  ],
  admin: [
    'VIEW_ADMIN_DASHBOARD',
    'MANAGE_USERS',
    'CHANGE_USER_ROLE',
    'TOGGLE_USER_STATUS',
    'VIEW_SYSTEM_STATUS',
    'MANAGE_APP_SETTINGS',
    'VIEW_ASSIGNED_STUDENTS',
    'VIEW_STUDENT_COURSEWORK',
    'VIEW_STUDENT_SESSIONS',
    'VIEW_BEHAVIORAL_ANALYSIS',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

// ─── Pre-Seeded Application User Directory ──────────────────────────────────

const INITIAL_USERS: UserProfile[] = [
  // 1. Demo Student (Mapped to S001 in prototype dataset)
  {
    id: 'usr-demo-student',
    name: 'Alex Chen (Demo Student)',
    email: 'student_demo@examguard.io',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-10 09:00:00',
    lastLogin: '2026-02-05 14:20:00',
    studentId: 'S001',
    department: 'Computer Science',
  },
  // 2. Demo Instructor (Human Reviewer)
  {
    id: 'usr-demo-instructor',
    name: 'Prof. Robert Davis (Demo Reviewer)',
    email: 'instructor_demo@examguard.io',
    role: 'instructor',
    status: 'active',
    createdAt: '2026-01-05 08:30:00',
    lastLogin: '2026-02-06 10:15:00',
    department: 'Engineering & Computing',
  },
  // 3. Demo Administrator (Platform Admin)
  {
    id: 'usr-demo-admin',
    name: 'Sarah Connor (Platform Admin)',
    email: 'admin_demo@examguard.io',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01 00:00:00',
    lastLogin: '2026-02-06 16:45:00',
    department: 'Academic Technology Services',
  },
  // Additional Cohort Students mapped to dataset S002–S010
  {
    id: 'usr-s002',
    name: 'Bhavna Patel',
    email: 's002@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-12 10:00:00',
    lastLogin: '2026-01-20 11:30:00',
    studentId: 'S002',
    department: 'Computer Science',
  },
  {
    id: 'usr-s003',
    name: 'Carlos Gomez',
    email: 's003@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-14 11:15:00',
    lastLogin: '2026-01-22 13:00:00',
    studentId: 'S003',
    department: 'Information Technology',
  },
  {
    id: 'usr-s004',
    name: 'David Kim',
    email: 's004@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-15 09:45:00',
    lastLogin: '2026-01-24 12:50:00',
    studentId: 'S004',
    department: 'Data Science',
  },
  {
    id: 'usr-s005',
    name: 'Elena Rostova',
    email: 's005@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-16 13:20:00',
    lastLogin: '2026-01-26 12:40:00',
    studentId: 'S005',
    department: 'Computer Science',
  },
  {
    id: 'usr-s006',
    name: 'Fatima Al-Mansoor',
    email: 's006@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-18 10:10:00',
    lastLogin: '2026-01-28 10:15:00',
    studentId: 'S006',
    department: 'Software Engineering',
  },
  {
    id: 'usr-s007',
    name: 'George Washington',
    email: 's007@university.edu',
    role: 'student',
    status: 'disabled', // Example disabled student for testing status filters
    createdAt: '2026-01-19 14:00:00',
    lastLogin: '2026-01-30 13:10:00',
    studentId: 'S007',
    department: 'Cybersecurity',
  },
  {
    id: 'usr-s008',
    name: 'Hannah Abbott',
    email: 's008@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-20 09:30:00',
    lastLogin: '2026-02-01 14:00:00',
    studentId: 'S008',
    department: 'Computer Science',
  },
  {
    id: 'usr-s009',
    name: 'Ian Malcolm',
    email: 's009@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-21 11:20:00',
    lastLogin: '2026-02-03 12:00:00',
    studentId: 'S009',
    department: 'Information Systems',
  },
  {
    id: 'usr-s010',
    name: 'Julia Roberts',
    email: 's010@university.edu',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-22 08:45:00',
    lastLogin: '2026-02-05 09:10:00',
    studentId: 'S010',
    department: 'Computer Science',
  },
  // Additional Instructors
  {
    id: 'usr-inst-2',
    name: 'Dr. Evelyn Reed',
    email: 'prof.reed@university.edu',
    role: 'instructor',
    status: 'active',
    createdAt: '2026-01-08 12:00:00',
    lastLogin: '2026-02-04 15:30:00',
    department: 'Computer Science',
  },
];

// In-memory state
let userRegistry: UserProfile[] = [...INITIAL_USERS];

// ─── Query Accessors ────────────────────────────────────────────────────────

export function getAllUsers(filter?: UserFilterOptions): UserProfile[] {
  let result = [...userRegistry];

  if (filter?.role && filter.role !== 'all') {
    result = result.filter((u) => u.role === filter.role);
  }

  if (filter?.status && filter.status !== 'all') {
    result = result.filter((u) => u.status === filter.status);
  }

  if (filter?.search && filter.search.trim() !== '') {
    const q = filter.search.toLowerCase().trim();
    result = result.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }

  return result;
}

export function getUserById(id: string): UserProfile | undefined {
  return userRegistry.find((u) => u.id === id);
}

export function getUserByEmail(email: string): UserProfile | undefined {
  return userRegistry.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getUsersByRole(role: UserRole): UserProfile[] {
  return userRegistry.filter((u) => u.role === role);
}

/**
 * Returns mapped dataset student_id for a given user or user ID.
 * Defaults to 'S001' for demo if unmapped.
 */
export function getMappedStudentId(userOrId?: UserProfile | string | null): string {
  if (!userOrId) return 'S001';

  let user: UserProfile | undefined;
  if (typeof userOrId === 'string') {
    user = getUserById(userOrId) || getUserByEmail(userOrId);
  } else {
    user = userOrId;
  }

  return user?.studentId || 'S001';
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function createUser(input: UserMutationInput): UserProfile {
  const newUser: UserProfile = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: input.status || 'active',
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    lastLogin: 'Never',
    studentId: input.role === 'student' ? input.studentId || `S${String(userRegistry.length + 1).padStart(3, '0')}` : undefined,
    department: input.department || 'General Academics',
  };

  userRegistry.push(newUser);
  return newUser;
}

export function updateUser(id: string, updates: Partial<UserMutationInput>): UserProfile {
  const index = userRegistry.findIndex((u) => u.id === id);
  if (index === -1) {
    throw new Error(`User with ID ${id} not found.`);
  }

  const existing = userRegistry[index];
  const updated: UserProfile = {
    ...existing,
    name: updates.name !== undefined ? updates.name.trim() : existing.name,
    email: updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email,
    role: updates.role !== undefined ? updates.role : existing.role,
    status: updates.status !== undefined ? updates.status : existing.status,
    studentId: updates.role === 'student' ? updates.studentId || existing.studentId : undefined,
    department: updates.department !== undefined ? updates.department : existing.department,
  };

  userRegistry[index] = updated;
  return updated;
}

export function toggleUserStatus(id: string): UserProfile {
  const user = getUserById(id);
  if (!user) {
    throw new Error(`User with ID ${id} not found.`);
  }
  const newStatus: UserStatus = user.status === 'active' ? 'disabled' : 'active';
  return updateUser(id, { status: newStatus });
}

export function changeUserRole(id: string, newRole: UserRole): UserProfile {
  return updateUser(id, { role: newRole });
}

export function deleteUser(id: string): boolean {
  const initialLen = userRegistry.length;
  userRegistry = userRegistry.filter((u) => u.id !== id);
  return userRegistry.length < initialLen;
}

export function resetUserRegistry(): void {
  userRegistry = [...INITIAL_USERS];
}

// ─── Demo Account Helpers ───────────────────────────────────────────────────

export interface DemoAccount {
  role: UserRole;
  label: string;
  name: string;
  email: string;
  description: string;
  mappedStudentId?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'student',
    label: 'Student Demo',
    name: 'Alex Chen',
    email: 'student_demo@examguard.io',
    description: 'Test-taker profile mapped to student S001 longitudinal records',
    mappedStudentId: 'S001',
  },
  {
    role: 'instructor',
    label: 'Instructor Demo',
    name: 'Prof. Robert Davis',
    email: 'instructor_demo@examguard.io',
    description: 'Human reviewer evaluating exam sessions & review queue',
  },
  {
    role: 'admin',
    label: 'Administrator Demo',
    name: 'Sarah Connor',
    email: 'admin_demo@examguard.io',
    description: 'Platform manager for user administration, roles & system oversight',
  },
];
