/**
 * Universal search and relationship graph domain models.
 */

export type SearchableEntityType =
  | 'STUDENT'
  | 'TEACHER'
  | 'GROUP'
  | 'COURSE'
  | 'LEAD'
  | 'PAYMENT'
  | 'EXAM'
  | 'EMPLOYEE'
  | 'BOOK'
  | 'CERTIFICATE';

export interface SearchResultItem {
  id: string;
  type: SearchableEntityType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  relevanceScore: number;
  metadata?: Record<string, unknown> | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  byType: Record<SearchableEntityType, number>;
  tookMs: number;
}

export type RelationshipType =
  | 'ENROLLED_IN'
  | 'TEACHES'
  | 'MEMBER_OF'
  | 'OWES_PAYMENT'
  | 'PAID'
  | 'PARENT_OF'
  | 'SCHEDULED_FOR'
  | 'EXAMINED'
  | 'CERTIFIED_FOR'
  | 'BORROWED'
  | 'ATTENDED'
  | 'ASSIGNED_TO'
  | 'GRADED_IN'
  | 'WORKS_ON'
  | 'MANAGES'
  | 'CUSTOM';

export interface GraphNode {
  id: string;
  type: SearchableEntityType;
  label: string;
  metadata?: Record<string, unknown> | null;
  weight?: number;
  /** Position for layout; absent means unpositioned. */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string | null;
  weight?: number;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface GraphResponse {
  rootNodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
}
