export type Professor = {
  id: string;
  name: string;
  photo_url: string | null;
  email: string | null;
  specialty: string | null;
  bio: string | null;
  accepting_students: boolean;
  lattes_url: string | null;
  department_id: string;
};

export type Laboratory = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  department_id: string;
};

export type ResearchLine = {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  laboratory_id: string | null;
  department_id: string;
};

export type Project = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  accepting_students: boolean;
  scholarship_available: boolean;
  keywords: string[];
  research_line_id: string | null;
  laboratory_id: string | null;
  lead_professor_id: string | null;
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  published: "Publicado",
  recruiting: "Recrutando",
  ongoing: "Em andamento",
  completed: "Concluído",
  archived: "Arquivado",
};
