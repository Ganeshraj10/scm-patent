/**
 * ExamGuard — Mock Questions
 * Sample MCQ bank for Phase 2 practice sessions.
 * Phase 1: Data only — not rendered yet.
 */

import type { Question } from '@/types';

export const mockQuestions: Question[] = [
  {
    id: 'q-001',
    examCode: 'CS301-MID',
    text: 'Which data structure follows the Last In, First Out (LIFO) principle?',
    options: ['Queue', 'Stack', 'Linked List', 'Heap'],
    correctIndex: 1,
    difficulty: 2,
    topic: 'Data Structures',
  },
  {
    id: 'q-002',
    examCode: 'CS301-MID',
    text: 'Which data structure follows the First In, First Out (FIFO) principle?',
    options: ['Stack', 'Tree', 'Queue', 'Graph'],
    correctIndex: 2,
    difficulty: 2,
    topic: 'Data Structures',
  },
  {
    id: 'q-003',
    examCode: 'CS301-MID',
    text: 'What is the time complexity of binary search in a sorted array of n elements?',
    options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'],
    correctIndex: 2,
    difficulty: 3,
    topic: 'Algorithms',
  },
  {
    id: 'q-004',
    examCode: 'CS301-MID',
    text: 'Which sorting algorithm has the best average-case time complexity?',
    options: ['Bubble Sort', 'Insertion Sort', 'Merge Sort', 'Selection Sort'],
    correctIndex: 2,
    difficulty: 3,
    topic: 'Algorithms',
  },
  {
    id: 'q-005',
    examCode: 'CS301-MID',
    text: 'In a min-heap, the root node always contains:',
    options: ['The maximum value', 'The minimum value', 'The median value', 'A random value'],
    correctIndex: 1,
    difficulty: 2,
    topic: 'Data Structures',
  },
  {
    id: 'q-006',
    examCode: 'CS301-MID',
    text: 'Which traversal visits the root node last in a binary tree?',
    options: ['Pre-order', 'In-order', 'Post-order', 'Level-order'],
    correctIndex: 2,
    difficulty: 3,
    topic: 'Trees',
  },
  {
    id: 'q-007',
    examCode: 'CS301-MID',
    text: 'What is the space complexity of Merge Sort?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    correctIndex: 2,
    difficulty: 4,
    topic: 'Algorithms',
  },
  {
    id: 'q-008',
    examCode: 'CS301-MID',
    text: 'A hash table with a good hash function has average-case lookup of:',
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
    correctIndex: 3,
    difficulty: 3,
    topic: 'Data Structures',
  },
  {
    id: 'q-009',
    examCode: 'CS301-MID',
    text: 'In Big-O notation, which of the following grows fastest as n increases?',
    options: ['O(n)', 'O(n log n)', 'O(2^n)', 'O(n²)'],
    correctIndex: 2,
    difficulty: 4,
    topic: 'Complexity',
  },
  {
    id: 'q-010',
    examCode: 'CS301-MID',
    text: 'Dijkstra\'s algorithm is used to find:',
    options: [
      'The minimum spanning tree',
      'The shortest path between nodes',
      'The topological order of nodes',
      'The maximum flow in a network',
    ],
    correctIndex: 1,
    difficulty: 4,
    topic: 'Graph Algorithms',
  },
];

export function getQuestionsByExam(examCode: string): Question[] {
  return mockQuestions.filter((q) => q.examCode === examCode);
}
