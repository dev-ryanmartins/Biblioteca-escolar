export interface User {
  id: number;
  name: string;
  is_admin: boolean;
  created_at: string;
}

export interface Student {
  id: number;
  name: string;
  grade: number;
  class: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface Book {
  id: number;
  catalog_code: string | null;
  title: string;
  author: string;
  quantity: number;
  available_quantity: number;
  publisher: string | null;
  publication_year: number | null;
  donor_name: string | null;
  donation_date: string | null;
  genre: string | null;
  is_donation: boolean;
  created_at: string;
}

export interface BookPreview {
  catalog_code: string | null;
  title: string;
  author: string;
  quantity: number;
  publisher: string | null;
  publication_year: number | null;
  donor_name: string | null;
  donation_date: string | null;
  inferred_genre: string;
  genre: string;
}

export interface BookInput {
  catalog_code: string | null;
  title: string;
  author: string;
  quantity: number;
  publisher: string | null;
  publication_year: number | null;
  donor_name: string | null;
  donation_date: string | null;
  genre: string;
  is_donation: boolean;
}

/** Loan record — student data stored inline, independent per ano_letivo */
export interface LoanDetail {
  id: number;
  ano_letivo: number;
  student_name: string;
  student_grade: number;
  student_class: string;
  student_phone: string | null;
  student_email: string | null;
  book_id: number;
  book_title: string;
  book_author: string;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  renewed: number;
  status: string;   // active | overdue | returned
  has_fine: boolean;
  fine_paid: boolean;
  created_at: string;
}

export interface FineDetail {
  id: number;
  loan_id: number;
  ano_letivo: number;
  student_name: string;
  student_grade: number;
  student_class: string;
  student_phone: string | null;
  book_title: string;
  book_author: string;
  due_date: string;
  days_overdue: number;
  status: string;
  donated_book_title: string | null;
  donated_book_author: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_books: number;
  total_students: number;
  active_loans: number;
  overdue_loans: number;
  pending_fines: number;
  loans_this_period: number;
  returns_this_period: number;
}

export interface ReportData {
  period_label: string;
  ano_letivo: number;
  total_loans: number;
  returned_loans: number;
  overdue_loans: number;
  fines_resolved: number;
  loans: LoanDetail[];
}

export interface ImportResult {
  success_count: number;
  error_count: number;
  errors: string[];
}

export interface MonthlyLoanCount {
  month: number;
  count: number;
}

export interface GenreCount {
  genre: string;
  count: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const VALID_CLASSES_BY_GRADE: Record<number, string[]> = {
  1: ['A', 'B'], 2: ['A', 'B'], 3: ['A', 'B', 'C'],
  4: ['A', 'B'], 5: ['A', 'B'], 6: ['A', 'B'],
  7: ['A', 'B'], 8: ['A', 'B'], 9: ['A', 'B'],
};

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const WEEKS = ['1ª Semana', '2ª Semana', '3ª Semana', '4ª Semana', '5ª Semana'];

export const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  overdue: 'Em Atraso',
  returned: 'Devolvido',
};

export function currentYear(): number {
  return new Date().getFullYear();
}

export function yearRange(span = 5): number[] {
  const y = currentYear();
  return Array.from({ length: span }, (_, i) => y - i + 1);
}
