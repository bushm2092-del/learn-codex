export type LessonStatus = "planned" | "draft" | "ready";

export interface LessonDefinition {
  id: string;
  order: number;
  path: string;
  title: {
    zh: string;
    en: string;
  };
  description: { zh: string; en: string };
  status: LessonStatus;
  available?: boolean;
}
