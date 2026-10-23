/** Best-effort grouping of a lab test name into a clinically familiar panel, for display only. */

interface CategoryRule {
  category: string;
  pattern: RegExp;
}

// Order matters — first matching rule wins (e.g. "Total Protein" must not fall into Kidney via a stray match).
const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Thyroid Profile', pattern: /\b(t3|t4|tsh|thyroid)\b/i },
  { category: 'Lipid Profile', pattern: /cholesterol|triglyceride|\bhdl\b|\bldl\b|\bvldl\b/i },
  { category: 'Blood Sugar / Diabetes', pattern: /glucose|hba1c|insulin/i },
  {
    category: 'Liver Function',
    pattern: /sgot|sgpt|\bast\b|\balt\b|alkaline phosphatase|\balp\b|bilirubin|albumin|globulin|a:g ratio|protein total|total protein|\bggt\b|ggtp|gamma glutamyl/i,
  },
  { category: 'Kidney Function', pattern: /creatinine|urea|\bbun\b|uric acid|\begfr\b|\bgfr\b/i },
  {
    category: 'Complete Blood Count (CBC)',
    pattern:
      /h(a)?emoglobin|\bwbc\b|\brbc\b|platelet|h(a)?ematocrit|\bpcv\b|\bmcv\b|\bmch\b|\bmchc\b|leu[ck]ocyte|neutrophil|lymphocyte|eosinophil|monocyte|basophil|\besr\b|\btlc\b|\bdlc\b/i,
  },
  { category: 'Electrolytes & Minerals', pattern: /sodium|potassium|chloride|calcium|phosphorus|magnesium/i },
  { category: 'Cardiac Markers', pattern: /troponin|\bcpk\b|ck-mb|\bldh\b/i },
  { category: 'Vitamins & Iron Studies', pattern: /vitamin|ferritin|folate|\btibc\b|iron/i },
  { category: 'Vitals', pattern: /\b(bp|blood pressure|pulse|heart rate)\b/i },
];

export function categorizeTestName(testName: string): string {
  const rule = CATEGORY_RULES.find((r) => r.pattern.test(testName));
  return rule?.category ?? 'Other';
}

export const TEST_CATEGORY_ORDER: string[] = [...CATEGORY_RULES.map((r) => r.category), 'Other'];
