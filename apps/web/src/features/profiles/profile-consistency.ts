import type { FieldKey } from './profile-model';
import { assessAlignment, isAlignmentFieldMissing, type AlignmentIssue } from './components/decision-panels/alignment-review.ts';

export type ProfileIssueSeverity = 'warning' | 'missing';
export interface ProfileIssue {
  id: string;
  title: string;
  description: string;
  fields: FieldKey[];
  severity: ProfileIssueSeverity;
  kind: AlignmentIssue['kind'];
}
export interface ProfileAssessment {
  issues: ProfileIssue[];
  completed: number;
}

export const isProfileFieldMissing = isAlignmentFieldMissing;

/** Shared educational review: no horizon cutoffs, suitability score or inferred portfolio risk. */
export function assessProfile(profile: Record<FieldKey, string>): ProfileAssessment {
  const issues = assessAlignment(profile).map(issue => ({
    id: issue.id, title: issue.title, description: issue.description, fields: issue.fields,
    kind: issue.kind, severity: issue.kind === 'missing' ? 'missing' as const : 'warning' as const,
  }));
  return { issues, completed: 8 - issues.filter(issue => issue.kind === 'missing').length };
}
