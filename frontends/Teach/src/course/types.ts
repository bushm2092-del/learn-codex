export type LessonStatus = "draft" | "ready";

export interface LessonDefinition {
  id: string;
  order: number;
  path: string;
  title: {
    zh: string;
    en: string;
  };
  status: LessonStatus;
}
