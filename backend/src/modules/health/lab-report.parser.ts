/**
 * Best-effort regex/heuristic extraction of lab test rows from raw text (PDF/OCR/Excel output),
 * mirroring the tax module's document parsers (no cloud OCR/AI) — every parsed row is surfaced
 * to the user for review/edit/delete before being relied upon, since report layouts vary widely.
 *
 * Real PDF text extraction (pdf-parse) does NOT preserve the visual column gaps of the original
 * layout as multiple spaces — a typical lab report row comes out as either:
 *   "Hemoglobin"              (name on its own line)
 *   "Method:Spectrophotometry" (skipped)
 *   "14.5 13.0-18.0 g/dL"      (value, range, unit on the following line)
 * or, for simpler single-row sections (e.g. vitals):
 *   "BP 144/103"               (name + value inline, single space)
 * Both shapes are handled below.
 */

export interface ParsedLabResult {
  testName: string;
  value: number;
  unit?: string;
  referenceLow?: number;
  referenceHigh?: number;
}

// Lines that are report chrome/metadata, never a test row — skipped outright.
const IGNORED_LINE_PATTERN =
  /^(method|note|reference|interpretation|impression|department of|page\s+\d|test report|please scan|tid\/sid|req\.?\s*no|ref\.?\s*by|age\s*\/\s*gender|registered on|collected on|reported on|name\s*:|consultant|dr\.?\s*[a-z]|doctor|mr\.?\s*[a-z]|mrs\.?\s*[a-z]|ms\.?\s*[a-z]|\d{1,3}\s*(?:years?|yrs?|y)\.?\s*\/\s*(?:male|female|other)|---|conclusion|chambers|valves|great arteries|septae|wall motion|colour doppler|floor|block\s|bio\.?\s*ref\.?\s*interval|test name\s+results|results\s+units\s+test name)/i;

// Bare gender field value, e.g. "Female" on its own line above the age — never a test name.
const GENDER_ONLY_LINE = /^(male|female|other)$/i;

// Standalone report/patient ID tokens, e.g. "BIL3545426", "UMR1240880" — never a test name.
const ID_TOKEN_PATTERN = /^[A-Z]{2,6}\d{4,}$/;

// Dates like "06-Oct-2023" or "06/10/2023" — a value line matching this is report metadata
// (registered/collected/reported timestamps), not a lab result, even though it starts with digits.
const DATE_LIKE_PATTERN = /^\d{1,2}[-/](?:[A-Za-z]{3,9}|\d{1,2})[-/]\d{2,4}/;

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const DASH = "[-\u2012\u2013\u2014~]"; // hyphen, figure/en/em dash, tilde

// "<name>  <value>[/<value2>]  <...rest>" all on one line (e.g. "BP 144/103", "LA dimension 3.4 (1.9-4.0 cm)").
const INLINE_NAME_VALUE = new RegExp(
  `^([A-Za-z][A-Za-z0-9()'./%, ]{1,58}?)\\s+(${NUMBER}(?:\\s*/\\s*${NUMBER})?)\\s*(.*)$`
);

// A line that's just a test name with no numbers at all — the value is expected on the next line.
// Digits fused into an abbreviation ("B12", "T3") are fine; a digit preceded by whitespace means
// this line actually already embeds its own value (e.g. a stray unit+value line like
// "thou/mm3        5.99") and must NOT be treated as a bare name awaiting a value on the next line.
const NAME_ONLY_LINE_PATTERN = /^[A-Za-z][A-Za-z0-9()'./%,\- ]{1,58}$/;
function isNameOnlyLine(line: string): boolean {
  return NAME_ONLY_LINE_PATTERN.test(line) && !/\s\d/.test(line);
}

// A line starting with a number (the "value line" that follows a name-only line).
const LEADING_VALUE = new RegExp(`^(${NUMBER}(?:\\s*/\\s*${NUMBER})?)\\s*(.*)$`);

// "<value>  <name>[  <...rest>]" — value leads instead of the name (seen in real diagnostic-lab
// PDFs, e.g. "0.62\tCreatinine" or "3.04\tGlobulin(Calculated) 2.0 - 3.5 gm/dL"). Distinct from
// LEADING_VALUE above, which only fires as the continuation of a preceding NAME_ONLY_LINE.
const LEADING_VALUE_NAME = new RegExp(`^(${NUMBER})\\s+([A-Za-z].*)$`);

// A standalone parenthetical method note on its own line (e.g. "(Jaffe Compensated)") that can
// sit between a "<value> <name>" line and its range/unit line — never a test row itself.
const METHOD_LINE_PATTERN = /^\(.*\)$/;

function looksLikeRangeOrBound(line: string): boolean {
  return RANGE_PATTERN.test(line) || UPPER_BOUND_PATTERN.test(line) || LOWER_BOUND_PATTERN.test(line);
}

const RANGE_PATTERN = new RegExp(`(${NUMBER})\\s*${DASH}\\s*(${NUMBER})`);
const UPPER_BOUND_PATTERN = new RegExp(`<=?\\s*(${NUMBER})`);
const LOWER_BOUND_PATTERN = new RegExp(`>=?\\s*(${NUMBER})`);

// Whitelist of common lab units — safer than grabbing an arbitrary trailing word (which is often
// part of the reference-range label text, e.g. "Optimal", "Borderline", "Risk"). No `\b` anchors:
// `\b` treats "µ" as a non-word character, so `\bµg\/dl\b` can never match (µ can't sit next to a
// word boundary) and silently falls through to matching the shorter "g/dl" instead, dropping the
// micro prefix — longer/more-specific alternatives are listed first instead.
const UNIT_WHITELIST =
  /(µIU\/mL|uIU\/mL|mIU\/mL|µg\/dl|ug\/dl|mg\/dl|g\/dl|mmol\/l|ng\/mL|ng\/dl|pg\/mL|U\/L|IU\/L|cells\/cumm|\/cumm|\/hpf|lakhs\/cumm|mill\/cumm|fL|pg|mm\/hour|mEq\/L|mmol|kg\/m2|mmHg|bpm|kg|cm|%)/i;


function cleanTestName(raw: string): string {
  return raw
    .trim()
    .replace(/[:.\-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Drops the repeated patient-info header block (name/age/gender/doctor/lab no./address) that
 * many lab-vendor PDFs print on every page, between its "Report Status" start and "Test Report"
 * end markers. Shared by the regex parser and the AI fallback parser so patient PII never has to
 * be sent to either.
 */
export function stripPatientHeaderBlock(rawText: string): string {
  let inHeaderBlock = false;
  return rawText
    .split(/\r?\n/)
    .filter((l) => {
      const trimmed = l.trim();
      if (/^report status$/i.test(trimmed)) {
        inHeaderBlock = true;
        return false;
      }
      if (/^test report$/i.test(trimmed)) {
        inHeaderBlock = false;
        return false;
      }
      return !inHeaderBlock;
    })
    .join("\n");
}

export interface PatientInfo {
  name?: string;
  age?: string;
  gender?: string;
}

const NAME_LABEL_PATTERN = /^(?:patient\s*)?name\s*:\s*(.+)$/i;
// Matches "28 Years / Male", "45 Yrs/Female", also embedded in a labelled line like
// "Age/Gender : 28 Years / Male" — searched anywhere in the line, not anchored.
const AGE_GENDER_PATTERN = /(\d{1,3})\s*(years?|yrs?|y)\.?\s*\/\s*(male|female|other)/i;
const GENDER_LABEL_PATTERN = /^(?:gender|sex)\s*:\s*(male|female|other)/i;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Extracts patient name/age/gender from the raw report text (searched before the patient header
 * block is stripped, since that's exactly where this metadata lives) so it can be shown once at
 * the top of the report instead of being silently discarded — or worse, misparsed as a repeated
 * test result row (see AGE_GENDER_PATTERN's twin in IGNORED_LINE_PATTERN).
 */
export function extractPatientInfo(rawText: string): PatientInfo {
  const info: PatientInfo = {};
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!info.name) {
      const nameMatch = line.match(NAME_LABEL_PATTERN);
      if (nameMatch) {
        const candidate = cleanTestName(nameMatch[1]);
        if (candidate.length >= 2 && candidate.length <= 60) info.name = candidate;
      }
    }
    if (!info.age || !info.gender) {
      const ageGenderMatch = line.match(AGE_GENDER_PATTERN);
      if (ageGenderMatch) {
        info.age = info.age ?? `${ageGenderMatch[1]} Years`;
        info.gender = info.gender ?? capitalize(ageGenderMatch[3]);
      }
    }
    if (!info.gender) {
      const genderMatch = line.match(GENDER_LABEL_PATTERN);
      if (genderMatch) info.gender = capitalize(genderMatch[1]);
    }
    if (info.name && info.age && info.gender) break;
  }

  return info;
}

function isIgnorable(line: string): boolean {
  if (!line) return true;
  if (IGNORED_LINE_PATTERN.test(line)) return true;
  if (ID_TOKEN_PATTERN.test(line)) return true;
  if (GENDER_ONLY_LINE.test(line)) return true;
  // Multi-word all-caps lines are section/panel headers, not test names — real test names are
  // Title Case (short all-caps abbreviations like "BP"/"TSH" have no space, so are unaffected).
  if (line.length > 12 && /\s/.test(line) && line === line.toUpperCase() && /[A-Z]/.test(line)) return true;
  return false;
}

function parseRest(rest: string): { unit?: string; referenceLow?: number; referenceHigh?: number } {
  const range = rest.match(RANGE_PATTERN);
  if (range) {
    const unitMatch = rest.match(UNIT_WHITELIST);
    return { referenceLow: Number(range[1]), referenceHigh: Number(range[2]), unit: unitMatch?.[0] };
  }
  const upper = rest.match(UPPER_BOUND_PATTERN);
  if (upper) {
    const unitMatch = rest.match(UNIT_WHITELIST);
    return { referenceHigh: Number(upper[1]), unit: unitMatch?.[0] };
  }
  const lower = rest.match(LOWER_BOUND_PATTERN);
  if (lower) {
    const unitMatch = rest.match(UNIT_WHITELIST);
    return { referenceLow: Number(lower[1]), unit: unitMatch?.[0] };
  }
  const unitMatch = rest.match(UNIT_WHITELIST);
  return { unit: unitMatch?.[0] };
}

/** Splits a combined "systolic/diastolic"-style value (e.g. "144/103") into two named rows. */
function buildRows(testName: string, rawValue: string, rest: string): ParsedLabResult[] {
  // Real lab test names are always capitalized — a lowercase-starting "name" is actually a
  // fragment of a free-text interpretation/note paragraph that happened to contain a number
  // (e.g. "...minimum between 6-10 pm...", "...for ASCVD risk..."), never a genuine result.
  if (!/^[A-Z]/.test(testName)) return [];

  const { unit, referenceLow, referenceHigh } = parseRest(rest);

  if (rawValue.includes("/")) {
    const [a, b] = rawValue.split("/").map((v) => Number(v.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return [
        { testName: `${testName} (Systolic)`, value: a, unit, referenceLow, referenceHigh },
        { testName: `${testName} (Diastolic)`, value: b, unit, referenceLow, referenceHigh },
      ];
    }
    return [];
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return [];
  return [{ testName, value, unit, referenceLow, referenceHigh }];
}

export function parseLabReportText(rawText: string): ParsedLabResult[] {
  // Many lab-vendor PDFs repeat a whole patient-info header block (name/age/gender/doctor/lab
  // no./address) at the top of every page, and pdf-parse's column-major text extraction scrambles
  // that block into a near-unrecognizable jumble of bare labels/values that no per-line pattern
  // can safely tell apart from real results — so drop everything between "Report Status" (its
  // start) and "Test Report" (the results table that follows it) rather than trying to parse it.
  const lines = stripPatientHeaderBlock(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !isIgnorable(l));

  const results: ParsedLabResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 3) continue;

    const inline = line.match(INLINE_NAME_VALUE);
    if (inline) {
      const [, rawName, rawValue, rest] = inline;
      const testName = cleanTestName(rawName);
      if (testName.length >= 2) {
        const rows = buildRows(testName, rawValue, rest);
        if (rows.length) {
          results.push(...rows);
          continue;
        }
      }
    }

    const leadingValueName = line.match(LEADING_VALUE_NAME);
    if (leadingValueName) {
      const [, rawValue, remainder] = leadingValueName;
      const rangeMatch = remainder.match(RANGE_PATTERN) ?? remainder.match(UPPER_BOUND_PATTERN) ?? remainder.match(LOWER_BOUND_PATTERN);
      const splitIdx = rangeMatch ? remainder.indexOf(rangeMatch[0]) : -1;
      const testName = cleanTestName(splitIdx >= 0 ? remainder.slice(0, splitIdx) : remainder);
      let rest = splitIdx >= 0 ? remainder.slice(splitIdx) : "";

      let consumed = 0;
      if (!rest) {
        // Method note and/or range/unit may follow on the next one or two lines instead.
        let lookahead = i + 1;
        if (lookahead < lines.length && METHOD_LINE_PATTERN.test(lines[lookahead])) {
          consumed += 1;
          lookahead += 1;
        }
        if (lookahead < lines.length && looksLikeRangeOrBound(lines[lookahead])) {
          rest = lines[lookahead];
          consumed += 1;
        }
      }

      if (testName.length >= 2) {
        const rows = buildRows(testName, rawValue, rest);
        if (rows.length) {
          results.push(...rows);
          i += consumed;
          continue;
        }
      }
    }

    if (isNameOnlyLine(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (DATE_LIKE_PATTERN.test(nextLine)) continue;
      const valueMatch = nextLine.match(LEADING_VALUE);
      if (valueMatch) {
        const testName = cleanTestName(line);
        const [, rawValue, rest] = valueMatch;
        if (testName.length >= 2) {
          const rows = buildRows(testName, rawValue, rest);
          if (rows.length) {
            results.push(...rows);
            i += 1; // consume the value line too
          }
        }
      }
    }
  }

  return results;
}

export function flagForValue(
  value: number,
  referenceLow?: number | null,
  referenceHigh?: number | null
): "LOW" | "NORMAL" | "HIGH" | "UNKNOWN" {
  if (referenceLow == null && referenceHigh == null) return "UNKNOWN";
  if (referenceLow != null && value < referenceLow) return "LOW";
  if (referenceHigh != null && value > referenceHigh) return "HIGH";
  return "NORMAL";
}

