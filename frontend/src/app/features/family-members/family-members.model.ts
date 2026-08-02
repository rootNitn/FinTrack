export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relation?: string | null;
  color?: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMemberFormValue {
  name: string;
  relation?: string;
  color?: string;
}

/** Common relation labels shown as quick-pick suggestions in the form (freeform text otherwise). */
export const FAMILY_MEMBER_RELATIONS = ['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
