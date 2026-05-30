export interface Company {
  id: string;
  name: string;
  departments: string[];
  settings: Record<string, unknown>;
}
