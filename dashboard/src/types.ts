export interface DataRecord {
  JNAME: string;
  [key: string]: any; // dynamic attributes
}

export interface ConsolidatedRecord {
  JNAME: string;
  [key: string]: any;
}

export interface CutoutRecord {
  JNAME: string;
  survey: string;
  band: string;
  file_path: string;
}

export interface DictionaryEntry {
  JNAME?: string[] | string;
  [key: string]: any;
}

export type Dictionary = Record<string, DictionaryEntry>;
