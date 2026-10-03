export interface DataRecord {
  JNAME: string;
  [key: string]: unknown; // dynamic attributes
}

export interface ConsolidatedRecord {
  JNAME: string;
  [key: string]: unknown;
}

export interface CutoutRecord {
  JNAME: string;
  survey: string;
  band: string;
  file_path: string;
}

export interface DictionaryEntry {
  JNAME?: string[] | string;
  [key: string]: unknown;
}

export type Dictionary = Record<string, DictionaryEntry>;
