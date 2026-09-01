/**
 * ExamGuard — Behavioral Validation Exam Question Bank
 * 
 * Stage 7: Realistic multi-format technical questions designed to validate
 * client-side derived behavioral feature capture across all 5 question types:
 * 1. Multiple Choice (MCQ)
 * 2. Multiple Select
 * 3. Short Answer
 * 4. Coding Questions (Python / JavaScript with test cases)
 * 5. Code Debugging Questions
 */

import { Question } from '@/types';

export const VALIDATION_EXAM_CODE = 'PROG_ALGO_VALIDATION_01';
export const VALIDATION_EXAM_TITLE = 'Programming & Algorithms — Behavioral Validation Exam';

export const validationExamQuestions: Question[] = [
  // ─── Q1: MCQ (Difficulty: 0.25) ─────────────────────────────────────────────
  {
    id: 'val-q01',
    examCode: VALIDATION_EXAM_CODE,
    type: 'mcq',
    title: 'FIFO Queue Data Structure Ordering',
    text: 'Which foundational data structure provides strict First-In, First-Out (FIFO) ordering for element insertions and deletions?',
    description: 'Assess fundamental understanding of linear container access patterns and queue queuing semantics.',
    difficulty: 0.25,
    topic: 'Data Structures',
    options: ['Stack', 'Queue', 'Binary Search Tree', 'Disjoint Set (Union-Find)'],
    correctIndex: 1,
    explanation: 'A Queue processes elements in First-In, First-Out (FIFO) sequence, whereas a Stack operates in Last-In, First-Out (LIFO) sequence.',
  },

  // ─── Q2: MCQ (Difficulty: 0.35) ─────────────────────────────────────────────
  {
    id: 'val-q02',
    examCode: VALIDATION_EXAM_CODE,
    type: 'mcq',
    title: 'Binary Search Algorithm Time Complexity',
    text: 'What is the average and worst-case time complexity of binary search when executed on a sorted array containing n elements?',
    description: 'Evaluate knowledge of logarithmic divide-and-conquer search boundaries.',
    difficulty: 0.35,
    topic: 'Algorithms',
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
    correctIndex: 1,
    explanation: 'Binary search halves the search range at each iteration, resulting in O(log n) comparisons.',
  },

  // ─── Q3: Multiple Select (Difficulty: 0.45) ─────────────────────────────────
  {
    id: 'val-q03',
    examCode: VALIDATION_EXAM_CODE,
    type: 'multiple_select',
    title: 'Invariants & Properties of Binary Search Trees',
    text: 'Which of the following statements are valid mathematical properties and invariants of a standard Binary Search Tree (BST)? (Select all that apply)',
    description: 'Select all statements that strictly hold true for valid Binary Search Trees without duplicates.',
    difficulty: 0.45,
    topic: 'Data Structures',
    options: [
      'For every node, all keys in its left subtree are strictly less than the node\'s key.',
      'For every node, all keys in its right subtree are strictly greater than the node\'s key.',
      'The root node is guaranteed to store the absolute minimum key in the entire tree.',
      'An in-order tree traversal visits all nodes in strictly ascending numerical order.',
    ],
    correctIndices: [0, 1, 3],
    explanation: 'Statements A, B, and D define the core BST ordering invariant and in-order traversal property. Statement C is false (the root is not necessarily the minimum; the leftmost leaf is).',
  },

  // ─── Q4: Short Answer (Difficulty: 0.50) ─────────────────────────────────────
  {
    id: 'val-q04',
    examCode: VALIDATION_EXAM_CODE,
    type: 'short_answer',
    title: 'Structural Comparison of BFS vs. DFS Graph Traversals',
    text: 'Explain the fundamental differences between Breadth-First Search (BFS) and Depth-First Search (DFS) in 2 to 4 sentences. Explicitly name the underlying data structure used by each traversal method.',
    description: 'Type your concise comparative explanation in the text area below. The system measures natural typing cadence and structure.',
    difficulty: 0.50,
    topic: 'Algorithms & Graph Theory',
    minWordCount: 15,
    expectedAnswer: 'BFS explores graph vertices level-by-level using a Queue (FIFO), finding shortest unweighted paths. In contrast, DFS traverses as deeply as possible along each branch before backtracking using a Stack (LIFO) or system call recursion.',
    explanation: 'Key concepts: BFS utilizes a Queue for level-by-level expansion; DFS utilizes a Stack or recursion for deep path exploration.',
  },

  // ─── Q5: Coding Question (Difficulty: 0.70) ──────────────────────────────────
  {
    id: 'val-q05',
    examCode: VALIDATION_EXAM_CODE,
    type: 'coding',
    title: 'Two Sum Target Indices Finder',
    text: 'Given an array of integers nums and an integer target, write a function two_sum(nums, target) that returns the 0-based indices of the two numbers such that they add up to target.',
    description: `### Problem Description
Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one valid solution, and you may not use the same element twice. You can return the answer in any order.

#### Example 1:
- **Input**: \`nums = [2, 7, 11, 15], target = 9\`
- **Output**: \`[0, 1]\`
- **Explanation**: Because \`nums[0] + nums[1] == 9\`, we return \`[0, 1]\`.

#### Example 2:
- **Input**: \`nums = [3, 2, 4], target = 6\`
- **Output**: \`[1, 2]\`

#### Constraints:
- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- Exactly one valid answer exists.`,
    difficulty: 0.70,
    topic: 'Hash Maps & Algorithms',
    language: 'python',
    starterCode: `def two_sum(nums, target):
    """
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Write your solution below
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []
`,
    testCases: [
      {
        id: 'tc-01',
        input: '{"nums": [2, 7, 11, 15], "target": 9}',
        expectedOutput: '[0, 1]',
        description: 'Standard positive integers',
      },
      {
        id: 'tc-02',
        input: '{"nums": [3, 2, 4], "target": 6}',
        expectedOutput: '[1, 2]',
        description: 'Target sum with unsorted indices',
      },
      {
        id: 'tc-03',
        input: '{"nums": [3, 3], "target": 6}',
        expectedOutput: '[0, 1]',
        description: 'Duplicate values adding to target',
      },
    ],
  },

  // ─── Q6: Coding Question (Difficulty: 0.75) ──────────────────────────────────
  {
    id: 'val-q06',
    examCode: VALIDATION_EXAM_CODE,
    type: 'coding',
    title: 'Valid Palindrome Alphanumeric Verifier',
    text: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.',
    description: `### Problem Description
Write a function \`is_palindrome(s)\` that accepts a string \`s\` and returns \`True\` if it is a palindrome, or \`False\` otherwise.

#### Example 1:
- **Input**: \`s = "A man, a plan, a canal: Panama"\`
- **Output**: \`True\`
- **Explanation**: "amanaplanacanalpanama" is a palindrome.

#### Example 2:
- **Input**: \`s = "race a car"\`
- **Output**: \`False\`
- **Explanation**: "raceacar" is not a palindrome.

#### Example 3:
- **Input**: \`s = " "\`
- **Output**: \`True\` (Empty string is a valid palindrome)`,
    difficulty: 0.75,
    topic: 'String Manipulation & Two Pointers',
    language: 'python',
    starterCode: `def is_palindrome(s):
    """
    :type s: str
    :rtype: bool
    """
    # Write your solution below
    filtered = [ch.lower() for ch in s if ch.isalnum()]
    return filtered == filtered[::-1]
`,
    testCases: [
      {
        id: 'tc-p1',
        input: '{"s": "A man, a plan, a canal: Panama"}',
        expectedOutput: 'True',
        description: 'Standard mixed-case palindrome with punctuation',
      },
      {
        id: 'tc-p2',
        input: '{"s": "race a car"}',
        expectedOutput: 'False',
        description: 'Non-palindrome string',
      },
      {
        id: 'tc-p3',
        input: '{"s": " "}',
        expectedOutput: 'True',
        description: 'Whitespace only empty string',
      },
    ],
  },

  // ─── Q7: Code Debugging Question (Difficulty: 0.80) ──────────────────────────
  {
    id: 'val-q07',
    examCode: VALIDATION_EXAM_CODE,
    type: 'debugging',
    title: 'Fix Faulty Recursive Factorial Implementation',
    text: 'The function below is intended to compute the factorial n! for non-negative integers n. However, it contains a critical bug causing it to return 0 for all values. Debug and correct the function.',
    description: `### Debugging Challenge
The following recursive implementation contains a base case error that corrupts the multiplication chain.

#### Faulty Starter Code:
\`\`\`python
def factorial(n):
    if n == 0:
        return 0  # <--- CRITICAL BUG
    return n * factorial(n - 1)
\`\`\`

#### Expected Math:
- $0! = 1$
- $1! = 1$
- $5! = 5 \\times 4 \\times 3 \\times 2 \\times 1 = 120$

Edit the code editor below to correct the base case so all test cases pass.`,
    difficulty: 0.80,
    topic: 'Recursion & Code Debugging',
    language: 'python',
    starterCode: `def factorial(n):
    # FIX THE BUG IN THE BASE CASE BELOW:
    if n == 0:
        return 0
    return n * factorial(n - 1)
`,
    testCases: [
      {
        id: 'tc-d1',
        input: '{"n": 0}',
        expectedOutput: '1',
        description: 'Zero base case: 0! = 1',
      },
      {
        id: 'tc-d2',
        input: '{"n": 1}',
        expectedOutput: '1',
        description: 'Unit base case: 1! = 1',
      },
      {
        id: 'tc-d3',
        input: '{"n": 5}',
        expectedOutput: '120',
        description: 'Factorial of 5: 5! = 120',
      },
      {
        id: 'tc-d4',
        input: '{"n": 6}',
        expectedOutput: '720',
        description: 'Factorial of 6: 6! = 720',
      },
    ],
  },

  // ─── Q8: Long-Form Technical Design Question (Difficulty: 0.65) ─────────────
  {
    id: 'val-q08',
    examCode: VALIDATION_EXAM_CODE,
    type: 'short_answer',
    title: 'Distributed Hash Ring Partitioning & Virtual Nodes Architecture',
    text: 'Analyze the trade-offs of virtual node replication in consistent hashing rings. Review the multi-section architecture specification below and provide a concise architectural synthesis.',
    description: `### Distributed Storage System Specification

#### 1. Consistent Hashing Mechanics
In standard consistent hashing, both cache nodes $N_1, N_2, \\dots, N_k$ and data keys $K_1, K_2, \\dots, K_m$ are mapped onto a 32-bit or 128-bit integer circular hash space (e.g. $[0, 2^{32}-1]$). A key is assigned to the first node whose position is greater than or equal to the key's position in clockwise order.

#### 2. The Non-Uniform Distribution Problem
When the number of physical nodes is small (e.g., $k < 10$), standard hashing functions often produce non-uniform clustering on the ring. Some nodes may receive up to $70\\%$ of the traffic while others remain virtually idle.

#### 3. Virtual Nodes (V-Nodes) Mitigation
To achieve uniform load distribution:
- Each physical node is assigned $V$ distinct virtual positions on the ring (e.g., $V = 100..250$).
- When a physical machine fails, its $V$ virtual nodes are distributed across various remaining physical machines, preventing cascading failovers.

---

### Question Prompt
In the answer box below, synthesize:
1. Why does traditional modular hashing ($hash(key) \\pmod N$) cause catastrophic cache invalidation during node scaling?
2. How do virtual nodes simultaneously solve the hotspot problem and the cascading failover problem?`,
    difficulty: 0.65,
    topic: 'Distributed Systems & System Design',
    minWordCount: 25,
    expectedAnswer: 'Traditional modulo hashing invalidates nearly 100% of keys when N changes because every key position remaps. Consistent hashing minimizes remapping to O(K/N) keys. Virtual nodes ensure uniform load distribution across the ring and spread the load of failed nodes evenly across all surviving machines.',
    explanation: 'Virtual nodes provide uniform distribution on the ring and balance recovery load upon server failure.',
  },
];
