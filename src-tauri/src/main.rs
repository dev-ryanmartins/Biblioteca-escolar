#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Datelike, Local, NaiveDate};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::State;

// ─────────────────────────────────────────────────────────── State ──────────
struct DbState(Mutex<Connection>);

// ─────────────────────────────────────────────────────── Data types ──────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct User {
    id: i64,
    name: String,
    is_admin: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Student {
    id: i64,
    name: String,
    grade: i64,
    class: String,
    phone: Option<String>,
    email: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Book {
    id: i64,
    catalog_code: Option<String>,
    title: String,
    author: String,
    quantity: i64,
    available_quantity: i64,
    publisher: Option<String>,
    publication_year: Option<i64>,
    donor_name: Option<String>,
    donation_date: Option<String>,
    genre: Option<String>,
    is_donation: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BookPreview {
    catalog_code: Option<String>,
    title: String,
    author: String,
    quantity: i64,
    publisher: Option<String>,
    publication_year: Option<i64>,
    donor_name: Option<String>,
    donation_date: Option<String>,
    inferred_genre: String,
    genre: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BookInput {
    catalog_code: Option<String>,
    title: String,
    author: String,
    quantity: i64,
    publisher: Option<String>,
    publication_year: Option<i64>,
    donor_name: Option<String>,
    donation_date: Option<String>,
    genre: String,
    is_donation: bool,
}

/// Loan record — student data is stored inline per loan (no FK to students table).
/// This allows the same student to appear in different years/grades independently.
#[derive(Debug, Serialize, Deserialize, Clone)]
struct LoanDetail {
    id: i64,
    ano_letivo: i64,
    student_name: String,
    student_grade: i64,
    student_class: String,
    student_phone: Option<String>,
    student_email: Option<String>,
    book_id: i64,
    book_title: String,
    book_author: String,
    loan_date: String,
    due_date: String,
    return_date: Option<String>,
    renewed: i64,
    status: String,        // active | overdue | returned
    has_fine: bool,        // fine pending or resolved for this loan
    fine_paid: bool,       // fine resolved (book donated)
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FineDetail {
    id: i64,
    loan_id: i64,
    ano_letivo: i64,
    student_name: String,
    student_grade: i64,
    student_class: String,
    student_phone: Option<String>,
    book_title: String,
    book_author: String,
    due_date: String,
    days_overdue: i64,
    status: String,
    donated_book_title: Option<String>,
    donated_book_author: Option<String>,
    resolved_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DashboardStats {
    total_books: i64,
    total_students: i64,
    active_loans: i64,
    overdue_loans: i64,
    pending_fines: i64,
    loans_this_period: i64,
    returns_this_period: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReportData {
    period_label: String,
    ano_letivo: i64,
    total_loans: i64,
    returned_loans: i64,
    overdue_loans: i64,
    fines_resolved: i64,
    loans: Vec<LoanDetail>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ImportResult {
    success_count: i64,
    error_count: i64,
    errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct MonthlyLoanCount {
    month: i64,
    count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GenreCount {
    genre: String,
    count: i64,
}

// ─────────────────────────────────────────────────── Database setup ──────────

fn init_db(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            is_admin      INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            grade      INTEGER NOT NULL,
            class      TEXT    NOT NULL,
            phone      TEXT,
            email      TEXT,
            created_at TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS books (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            catalog_code        TEXT,
            title               TEXT    NOT NULL,
            author              TEXT    NOT NULL,
            quantity            INTEGER NOT NULL DEFAULT 1,
            available_quantity  INTEGER NOT NULL DEFAULT 1,
            publisher           TEXT,
            publication_year    INTEGER,
            donor_name          TEXT,
            donation_date       TEXT,
            genre               TEXT,
            is_donation         INTEGER NOT NULL DEFAULT 0,
            created_at          TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS loans (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            ano_letivo      INTEGER NOT NULL,
            student_name    TEXT    NOT NULL,
            student_grade   INTEGER NOT NULL,
            student_class   TEXT    NOT NULL,
            student_phone   TEXT,
            student_email   TEXT,
            book_id         INTEGER NOT NULL,
            loan_date       TEXT    NOT NULL,
            due_date        TEXT    NOT NULL,
            return_date     TEXT,
            renewed         INTEGER NOT NULL DEFAULT 0,
            status          TEXT    NOT NULL DEFAULT 'active',
            created_at      TEXT    NOT NULL,
            FOREIGN KEY (book_id) REFERENCES books(id)
        );

        CREATE TABLE IF NOT EXISTS fines (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_id             INTEGER NOT NULL UNIQUE,
            status              TEXT    NOT NULL DEFAULT 'pending',
            donated_book_title  TEXT,
            donated_book_author TEXT,
            resolved_at         TEXT,
            created_at          TEXT    NOT NULL,
            FOREIGN KEY (loan_id) REFERENCES loans(id)
        );
        ",
    )?;
    Ok(())
}

// ──────────────────────────────────────────────── Helper functions ──────────

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"biblioteca_salt_escola_2024_");
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

fn now_str() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn today_str() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn infer_genre(title: &str, author: &str) -> String {
    let text = format!("{} {}", title, author).to_lowercase();
    let genre_keywords: &[(&str, &[&str])] = &[
        ("Aventura",          &["aventura","exploração","missão","herói","heróis","viagem","descoberta","jornada","expedição","pirata","tesouro","selva"]),
        ("Fantasia",          &["fantasia","magia","mágico","dragão","fada","duende","reino","encantado","bruxo","bruxa","feitiço","elfo","hobbit","vampire","vampiro"]),
        ("Ficção Científica", &["robô","espaço","nave","planeta","futuro","tecnologia","android","alienígena","galáxia","cibernético"]),
        ("Romance",           &["amor","romance","paixão","coração","namoro","beijo","casamento","apaixonado"]),
        ("Mistério/Terror",   &["mistério","terror","assustador","fantasma","medo","sombra","crime","detetive","segredo","assassinato","policial","horror"]),
        ("História/Biografia",&["história","histórico","guerra","revolução","biografia","memórias","brasil","ditadura","república","império"]),
        ("Humor",             &["humor","divertido","engraçado","piada","comédia","risada"]),
        ("Poesia",            &["poesia","poemas","versos","rimas","lírica","soneto"]),
        ("Infantil/Fábula",   &["fábula","fábulas","conto","contos","príncipe","princesa","lobo","infantil","criança","crianças","unicórnio","dinossauro"]),
        ("Educativo/Ciências",&["ciência","matemática","natureza","animal","planeta","corpo humano","experimento","escola","geografia","física","química","biologia","ecologia"]),
        ("Clássico",          &["clássico","shakespeare","machado","dickens","dostoiévski","tolstói","cervantes","verne","dumas","twain","austen","monteiro lobato"]),
    ];
    let mut best_genre = "Geral";
    let mut best_count = 0usize;
    for (genre, keywords) in genre_keywords {
        let count = keywords.iter().filter(|kw| text.contains(*kw)).count();
        if count > best_count { best_count = count; best_genre = genre; }
    }
    best_genre.to_string()
}

fn validate_grade_class(grade: i64, class: &str) -> bool {
    if grade < 1 || grade > 9 { return false; }
    let valid = if grade == 3 { vec!["A","B","C"] } else { vec!["A","B"] };
    valid.contains(&class)
}

fn days_between(from: &str, to: &str) -> i64 {
    let a = NaiveDate::parse_from_str(from, "%Y-%m-%d").unwrap_or_default();
    let b = NaiveDate::parse_from_str(to, "%Y-%m-%d").unwrap_or_default();
    (b - a).num_days()
}

/// Given week number (1-5), return (start_day, end_day) for the month.
fn week_day_range(week: i64) -> (i64, i64) {
    match week {
        1 => (1, 7),
        2 => (8, 14),
        3 => (15, 21),
        4 => (22, 28),
        5 => (29, 31),
        _ => (1, 31),
    }
}

fn fetch_loan_detail(conn: &Connection, loan_id: i64) -> Result<LoanDetail, rusqlite::Error> {
    conn.query_row(
        "SELECT l.id, l.ano_letivo, l.student_name, l.student_grade, l.student_class,
                l.student_phone, l.student_email,
                l.book_id, b.title, b.author,
                l.loan_date, l.due_date, l.return_date, l.renewed, l.status, l.created_at,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id = l.id) AS has_fine,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id = l.id AND f.status='resolved') AS fine_paid
         FROM loans l JOIN books b ON b.id = l.book_id
         WHERE l.id = ?1",
        params![loan_id],
        |r| {
            Ok(LoanDetail {
                id: r.get(0)?,
                ano_letivo: r.get(1)?,
                student_name: r.get(2)?,
                student_grade: r.get(3)?,
                student_class: r.get(4)?,
                student_phone: r.get(5)?,
                student_email: r.get(6)?,
                book_id: r.get(7)?,
                book_title: r.get(8)?,
                book_author: r.get(9)?,
                loan_date: r.get(10)?,
                due_date: r.get(11)?,
                return_date: r.get(12)?,
                renewed: r.get(13)?,
                status: r.get(14)?,
                created_at: r.get(15)?,
                has_fine: r.get::<_, i64>(16)? > 0,
                fine_paid: r.get::<_, i64>(17)? > 0,
            })
        },
    )
}

// ─────────────────────────────────────────────── Tauri commands ──────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

#[tauri::command]
fn check_first_run(state: State<DbState>) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count == 0)
}

#[tauri::command]
fn create_user(
    state: State<DbState>,
    name: String,
    password: String,
    is_admin: bool,
) -> Result<User, String> {
    let name = name.trim().to_string();
    if name.is_empty() || password.trim().is_empty() {
        return Err("Usuário e senha são obrigatórios.".to_string());
    }
    if password.len() < 4 {
        return Err("A senha deve ter pelo menos 4 caracteres.".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let hash = hash_password(&password);
    let now = now_str();
    conn.execute(
        "INSERT INTO users (name, password_hash, is_admin, created_at) VALUES (?1,?2,?3,?4)",
        params![name, hash, is_admin as i64, now],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Já existe um usuário com esse nome.".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(User { id, name, is_admin, created_at: now })
}

#[tauri::command]
fn login(state: State<DbState>, name: String, password: String) -> Result<User, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let hash = hash_password(&password);
    conn.query_row(
        "SELECT id, name, is_admin, created_at FROM users WHERE name = ?1 AND password_hash = ?2",
        params![name.trim(), hash],
        |r| Ok(User {
            id: r.get(0)?,
            name: r.get(1)?,
            is_admin: r.get::<_, i64>(2)? != 0,
            created_at: r.get(3)?,
        }),
    )
    .map_err(|_| "Usuário ou senha inválidos.".to_string())
}

#[tauri::command]
fn list_users(state: State<DbState>) -> Result<Vec<User>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, is_admin, created_at FROM users ORDER BY name")
        .map_err(|e| e.to_string())?;
    let users = stmt.query_map([], |r| Ok(User {
        id: r.get(0)?,
        name: r.get(1)?,
        is_admin: r.get::<_, i64>(2)? != 0,
        created_at: r.get(3)?,
    }))
    .map_err(|e| e.to_string())?
    .filter_map(|u| u.ok())
    .collect();
    Ok(users)
}

#[tauri::command]
fn delete_user(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let admin_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users WHERE is_admin=1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let is_admin: i64 = conn
        .query_row("SELECT is_admin FROM users WHERE id=?1", params![id], |r| r.get(0))
        .map_err(|_| "Usuário não encontrado.".to_string())?;
    if is_admin != 0 && admin_count <= 1 {
        return Err("Não é possível excluir o único administrador do sistema.".to_string());
    }
    conn.execute("DELETE FROM users WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Students ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn import_students_csv(state: State<DbState>, content: String) -> Result<ImportResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut rdr = csv::ReaderBuilder::new().flexible(true).trim(csv::Trim::All).from_reader(content.as_bytes());
    let mut success = 0i64;
    let mut errors: Vec<String> = Vec::new();
    for (i, result) in rdr.records().enumerate() {
        let row_num = i + 2;
        match result {
            Err(e) => errors.push(format!("Linha {}: {}", row_num, e)),
            Ok(record) => {
                let name = record.get(0).unwrap_or("").trim().to_string();
                let grade_str = record.get(1).unwrap_or("").trim().to_string();
                let class = record.get(2).unwrap_or("").trim().to_uppercase();
                let phone = record.get(3).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                let email = record.get(4).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                if name.is_empty() { errors.push(format!("Linha {}: Nome vazio.", row_num)); continue; }
                let grade: i64 = match grade_str.parse() {
                    Ok(g) => g,
                    Err(_) => { errors.push(format!("Linha {}: Série inválida '{}'.", row_num, grade_str)); continue; }
                };
                if !validate_grade_class(grade, &class) {
                    errors.push(format!("Linha {}: {}° Ano Turma '{}' inválida.", row_num, grade, class));
                    continue;
                }
                match conn.execute(
                    "INSERT INTO students (name,grade,class,phone,email,created_at) VALUES (?1,?2,?3,?4,?5,?6)",
                    params![name, grade, class, phone, email, now_str()],
                ) {
                    Ok(_) => success += 1,
                    Err(e) => errors.push(format!("Linha {}: {}", row_num, e)),
                }
            }
        }
    }
    Ok(ImportResult { success_count: success, error_count: errors.len() as i64, errors })
}

#[tauri::command]
fn list_students(state: State<DbState>, search: Option<String>, grade: Option<i64>, class: Option<String>) -> Result<Vec<Student>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let search_pat = format!("%{}%", search.as_deref().unwrap_or(""));
    let mut stmt = conn.prepare(
        "SELECT id,name,grade,class,phone,email,created_at FROM students
         WHERE (?1 IS NULL OR name LIKE ?1) AND (?2 IS NULL OR grade=?2) AND (?3 IS NULL OR class=?3)
         ORDER BY grade, class, name"
    ).map_err(|e| e.to_string())?;
    let students = stmt.query_map(
        params![if search.is_none() { None } else { Some(search_pat) }, grade, class],
        |r| Ok(Student { id: r.get(0)?, name: r.get(1)?, grade: r.get(2)?, class: r.get(3)?, phone: r.get(4)?, email: r.get(5)?, created_at: r.get(6)? }),
    ).map_err(|e| e.to_string())?.filter_map(|s| s.ok()).collect();
    Ok(students)
}

#[tauri::command]
fn delete_student(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM students WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Books ─────────────────────────────────────────────────────────────────────

#[tauri::command]
fn parse_books_csv(content: String) -> Result<Vec<BookPreview>, String> {
    let mut rdr = csv::ReaderBuilder::new().flexible(true).trim(csv::Trim::All).from_reader(content.as_bytes());
    let mut books: Vec<BookPreview> = Vec::new();
    for result in rdr.records() {
        let record = result.map_err(|e| e.to_string())?;
        let catalog_code = record.get(0).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let title = record.get(1).unwrap_or("").trim().to_string();
        let author = record.get(2).unwrap_or("").trim().to_string();
        let quantity: i64 = record.get(3).and_then(|s| s.parse().ok()).unwrap_or(1);
        let publisher = record.get(4).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let publication_year: Option<i64> = record.get(5).and_then(|s| s.parse().ok());
        let donor_name = record.get(6).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let donation_date = record.get(7).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        if title.is_empty() { continue; }
        let inferred_genre = infer_genre(&title, &author);
        let genre = inferred_genre.clone();
        books.push(BookPreview { catalog_code, title, author, quantity, publisher, publication_year, donor_name, donation_date, inferred_genre, genre });
    }
    Ok(books)
}

#[tauri::command]
fn confirm_books_import(state: State<DbState>, books: Vec<BookInput>) -> Result<ImportResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut success = 0i64;
    let mut errors: Vec<String> = Vec::new();
    for book in books {
        match conn.execute(
            "INSERT INTO books (catalog_code,title,author,quantity,available_quantity,publisher,publication_year,donor_name,donation_date,genre,is_donation,created_at)
             VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![book.catalog_code, book.title, book.author, book.quantity, book.publisher, book.publication_year, book.donor_name, book.donation_date,
                    if book.genre.is_empty() { None } else { Some(book.genre) }, book.is_donation as i64, now_str()],
        ) {
            Ok(_) => success += 1,
            Err(e) => errors.push(e.to_string()),
        }
    }
    Ok(ImportResult { success_count: success, error_count: errors.len() as i64, errors })
}

#[tauri::command]
fn add_book(state: State<DbState>, book: BookInput) -> Result<Book, String> {
    if book.title.trim().is_empty() || book.author.trim().is_empty() {
        return Err("Título e autor são obrigatórios.".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = now_str();
    conn.execute(
        "INSERT INTO books (catalog_code,title,author,quantity,available_quantity,publisher,publication_year,donor_name,donation_date,genre,is_donation,created_at)
         VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![book.catalog_code, book.title.trim(), book.author.trim(), book.quantity, book.publisher, book.publication_year,
                book.donor_name, book.donation_date, if book.genre.is_empty() { None } else { Some(book.genre.clone()) }, book.is_donation as i64, now],
    ).map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Book { id, catalog_code: book.catalog_code, title: book.title.trim().to_string(), author: book.author.trim().to_string(),
               quantity: book.quantity, available_quantity: book.quantity, publisher: book.publisher, publication_year: book.publication_year,
               donor_name: book.donor_name, donation_date: book.donation_date, genre: if book.genre.is_empty() { None } else { Some(book.genre) },
               is_donation: book.is_donation, created_at: now })
}

#[tauri::command]
fn list_books(state: State<DbState>, search: Option<String>, genre: Option<String>) -> Result<Vec<Book>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let search_pat = format!("%{}%", search.as_deref().unwrap_or(""));
    let mut stmt = conn.prepare(
        "SELECT id,catalog_code,title,author,quantity,available_quantity,publisher,publication_year,donor_name,donation_date,genre,is_donation,created_at
         FROM books WHERE (?1 IS NULL OR title LIKE ?1 OR author LIKE ?1 OR catalog_code LIKE ?1) AND (?2 IS NULL OR genre=?2) ORDER BY title"
    ).map_err(|e| e.to_string())?;
    let books = stmt.query_map(
        params![if search.is_none() { None } else { Some(search_pat) }, genre],
        |r| Ok(Book { id: r.get(0)?, catalog_code: r.get(1)?, title: r.get(2)?, author: r.get(3)?, quantity: r.get(4)?, available_quantity: r.get(5)?,
                       publisher: r.get(6)?, publication_year: r.get(7)?, donor_name: r.get(8)?, donation_date: r.get(9)?, genre: r.get(10)?,
                       is_donation: r.get::<_, i64>(11)? != 0, created_at: r.get(12)? }),
    ).map_err(|e| e.to_string())?.filter_map(|b| b.ok()).collect();
    Ok(books)
}

#[tauri::command]
fn update_book(state: State<DbState>, id: i64, book: BookInput) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE books SET catalog_code=?1,title=?2,author=?3,quantity=?4,publisher=?5,publication_year=?6,donor_name=?7,donation_date=?8,genre=?9,is_donation=?10 WHERE id=?11",
        params![book.catalog_code, book.title, book.author, book.quantity, book.publisher, book.publication_year, book.donor_name, book.donation_date,
                if book.genre.is_empty() { None } else { Some(book.genre) }, book.is_donation as i64, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_book(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let active: i64 = conn.query_row("SELECT COUNT(*) FROM loans WHERE book_id=?1 AND status!='returned'", params![id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if active > 0 { return Err("Livro possui empréstimos ativos e não pode ser excluído.".to_string()); }
    conn.execute("DELETE FROM books WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_genres(state: State<DbState>) -> Result<Vec<GenreCount>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT COALESCE(genre,'Geral'), COUNT(*) FROM books GROUP BY genre ORDER BY COUNT(*) DESC").map_err(|e| e.to_string())?;
    let genres = stmt.query_map([], |r| Ok(GenreCount { genre: r.get(0)?, count: r.get(1)? })).map_err(|e| e.to_string())?.filter_map(|g| g.ok()).collect();
    Ok(genres)
}

// ── Loans ─────────────────────────────────────────────────────────────────────

#[tauri::command]
fn create_loan(
    state: State<DbState>,
    ano_letivo: i64,
    student_name: String,
    student_grade: i64,
    student_class: String,
    student_phone: Option<String>,
    student_email: Option<String>,
    book_id: i64,
    due_date: String,
) -> Result<LoanDetail, String> {
    if student_name.trim().is_empty() { return Err("Nome do aluno é obrigatório.".to_string()); }
    if !validate_grade_class(student_grade, &student_class) {
        return Err(format!("Turma '{}' inválida para o {}° Ano.", student_class, student_grade));
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let available: i64 = conn.query_row("SELECT available_quantity FROM books WHERE id=?1", params![book_id], |r| r.get(0))
        .map_err(|_| "Livro não encontrado.".to_string())?;
    if available <= 0 { return Err("Nenhum exemplar disponível para empréstimo.".to_string()); }

    // Check if this student already has an overdue loan in the same ano_letivo
    let overdue: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE LOWER(student_name)=LOWER(?1) AND ano_letivo=?2 AND status='overdue'",
        params![student_name.trim(), ano_letivo], |r| r.get(0),
    ).map_err(|e| e.to_string())?;
    if overdue > 0 { return Err("Este aluno possui um empréstimo em atraso neste ano letivo. Regularize antes de fazer novo empréstimo.".to_string()); }

    // Check pending fine
    let fines: i64 = conn.query_row(
        "SELECT COUNT(*) FROM fines f JOIN loans l ON l.id=f.loan_id WHERE LOWER(l.student_name)=LOWER(?1) AND l.ano_letivo=?2 AND f.status='pending'",
        params![student_name.trim(), ano_letivo], |r| r.get(0),
    ).map_err(|e| e.to_string())?;
    if fines > 0 { return Err("Este aluno possui multa pedagógica pendente neste ano letivo. Regularize antes de fazer novo empréstimo.".to_string()); }

    let today = today_str();
    let now = now_str();
    conn.execute(
        "INSERT INTO loans (ano_letivo,student_name,student_grade,student_class,student_phone,student_email,book_id,loan_date,due_date,renewed,status,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,0,'active',?10)",
        params![ano_letivo, student_name.trim(), student_grade, student_class, student_phone, student_email, book_id, today, due_date, now],
    ).map_err(|e| e.to_string())?;
    let loan_id = conn.last_insert_rowid();
    conn.execute("UPDATE books SET available_quantity=available_quantity-1 WHERE id=?1", params![book_id]).map_err(|e| e.to_string())?;
    fetch_loan_detail(&conn, loan_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn return_book(state: State<DbState>, loan_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let today = today_str();
    let now = now_str();
    let (book_id, due_date, status): (i64, String, String) = conn.query_row(
        "SELECT book_id, due_date, status FROM loans WHERE id=?1",
        params![loan_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).map_err(|_| "Empréstimo não encontrado.".to_string())?;
    if status == "returned" { return Err("Este empréstimo já foi devolvido.".to_string()); }
    conn.execute("UPDATE loans SET return_date=?1, status='returned' WHERE id=?2", params![today, loan_id]).map_err(|e| e.to_string())?;
    conn.execute("UPDATE books SET available_quantity=available_quantity+1 WHERE id=?1", params![book_id]).map_err(|e| e.to_string())?;
    // Generate fine if overdue
    if today.as_str() > due_date.as_str() || status == "overdue" {
        let existing: i64 = conn.query_row("SELECT COUNT(*) FROM fines WHERE loan_id=?1", params![loan_id], |r| r.get(0)).unwrap_or(0);
        if existing == 0 {
            conn.execute("INSERT INTO fines (loan_id,status,created_at) VALUES (?1,'pending',?2)", params![loan_id, now]).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn renew_loan(state: State<DbState>, loan_id: i64, new_due_date: String) -> Result<LoanDetail, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE loans SET due_date=?1, renewed=renewed+1, status='active' WHERE id=?2", params![new_due_date, loan_id]).map_err(|e| e.to_string())?;
    fetch_loan_detail(&conn, loan_id).map_err(|e| e.to_string())
}

fn mark_overdue_internal(conn: &Connection) -> Result<(), rusqlite::Error> {
    let today = today_str();
    conn.execute("UPDATE loans SET status='overdue' WHERE status='active' AND due_date < ?1", params![today])?;
    Ok(())
}

#[tauri::command]
fn mark_overdue_loans(state: State<DbState>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let today = today_str();
    let count = conn.execute("UPDATE loans SET status='overdue' WHERE status='active' AND due_date < ?1", params![today]).map_err(|e| e.to_string())?;
    Ok(count as i64)
}

#[tauri::command]
fn list_loans(
    state: State<DbState>,
    ano_letivo: Option<i64>,
    month: Option<i64>,
    week: Option<i64>,
    status: Option<String>,
    search: Option<String>,
) -> Result<Vec<LoanDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    mark_overdue_internal(&conn).ok();

    let search_pat = format!("%{}%", search.as_deref().unwrap_or(""));
    let (week_start, week_end) = week.map(week_day_range).unwrap_or((1, 31));

    let mut stmt = conn.prepare(
        "SELECT l.id, l.ano_letivo, l.student_name, l.student_grade, l.student_class,
                l.student_phone, l.student_email,
                l.book_id, b.title, b.author,
                l.loan_date, l.due_date, l.return_date, l.renewed, l.status, l.created_at,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id) AS has_fine,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id AND f.status='resolved') AS fine_paid
         FROM loans l JOIN books b ON b.id=l.book_id
         WHERE (?1 IS NULL OR l.ano_letivo=?1)
           AND (?2 IS NULL OR CAST(strftime('%m',l.loan_date) AS INTEGER)=?2)
           AND (?3 IS NULL OR CAST(strftime('%d',l.loan_date) AS INTEGER) BETWEEN ?4 AND ?5)
           AND (?6 IS NULL OR l.status=?6)
           AND (?7 IS NULL OR l.student_name LIKE ?7 OR b.title LIKE ?7)
         ORDER BY l.loan_date DESC, l.id DESC"
    ).map_err(|e| e.to_string())?;

    let loans = stmt.query_map(
        params![
            ano_letivo,
            month,
            week,
            week_start,
            week_end,
            status,
            if search.is_none() { None } else { Some(search_pat) },
        ],
        |r| Ok(LoanDetail {
            id: r.get(0)?, ano_letivo: r.get(1)?, student_name: r.get(2)?,
            student_grade: r.get(3)?, student_class: r.get(4)?, student_phone: r.get(5)?,
            student_email: r.get(6)?, book_id: r.get(7)?, book_title: r.get(8)?,
            book_author: r.get(9)?, loan_date: r.get(10)?, due_date: r.get(11)?,
            return_date: r.get(12)?, renewed: r.get(13)?, status: r.get(14)?,
            created_at: r.get(15)?,
            has_fine: r.get::<_, i64>(16)? > 0,
            fine_paid: r.get::<_, i64>(17)? > 0,
        }),
    ).map_err(|e| e.to_string())?.filter_map(|l| l.ok()).collect();
    Ok(loans)
}

#[tauri::command]
fn list_overdue_loans(state: State<DbState>) -> Result<Vec<LoanDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    mark_overdue_internal(&conn).ok();
    let mut stmt = conn.prepare(
        "SELECT l.id, l.ano_letivo, l.student_name, l.student_grade, l.student_class,
                l.student_phone, l.student_email,
                l.book_id, b.title, b.author,
                l.loan_date, l.due_date, l.return_date, l.renewed, l.status, l.created_at,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id) AS has_fine,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id AND f.status='resolved') AS fine_paid
         FROM loans l JOIN books b ON b.id=l.book_id
         WHERE l.status='overdue' ORDER BY l.due_date ASC"
    ).map_err(|e| e.to_string())?;
    let loans = stmt.query_map([], |r| Ok(LoanDetail {
        id: r.get(0)?, ano_letivo: r.get(1)?, student_name: r.get(2)?,
        student_grade: r.get(3)?, student_class: r.get(4)?, student_phone: r.get(5)?,
        student_email: r.get(6)?, book_id: r.get(7)?, book_title: r.get(8)?,
        book_author: r.get(9)?, loan_date: r.get(10)?, due_date: r.get(11)?,
        return_date: r.get(12)?, renewed: r.get(13)?, status: r.get(14)?,
        created_at: r.get(15)?,
        has_fine: r.get::<_, i64>(16)? > 0,
        fine_paid: r.get::<_, i64>(17)? > 0,
    })).map_err(|e| e.to_string())?.filter_map(|l| l.ok()).collect();
    Ok(loans)
}

#[tauri::command]
fn get_dashboard_stats(state: State<DbState>, ano_letivo: Option<i64>) -> Result<DashboardStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    mark_overdue_internal(&conn).ok();
    let now = Local::now();
    let month = now.month() as i64;
    let year = now.year() as i64;
    let filter_year = ano_letivo.unwrap_or(year);

    let total_books: i64 = conn.query_row("SELECT COALESCE(SUM(quantity),0) FROM books", [], |r| r.get(0)).unwrap_or(0);
    let total_students: i64 = conn.query_row("SELECT COUNT(*) FROM students", [], |r| r.get(0)).unwrap_or(0);
    let active_loans: i64 = conn.query_row("SELECT COUNT(*) FROM loans WHERE status='active' AND ano_letivo=?1", params![filter_year], |r| r.get(0)).unwrap_or(0);
    let overdue_loans: i64 = conn.query_row("SELECT COUNT(*) FROM loans WHERE status='overdue' AND ano_letivo=?1", params![filter_year], |r| r.get(0)).unwrap_or(0);
    let pending_fines: i64 = conn.query_row(
        "SELECT COUNT(*) FROM fines f JOIN loans l ON l.id=f.loan_id WHERE f.status='pending' AND l.ano_letivo=?1", params![filter_year], |r| r.get(0)
    ).unwrap_or(0);
    let loans_this_period: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE ano_letivo=?1 AND CAST(strftime('%m',loan_date) AS INTEGER)=?2", params![filter_year, month], |r| r.get(0)
    ).unwrap_or(0);
    let returns_this_period: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE status='returned' AND ano_letivo=?1 AND CAST(strftime('%m',return_date) AS INTEGER)=?2",
        params![filter_year, month], |r| r.get(0)
    ).unwrap_or(0);

    Ok(DashboardStats { total_books, total_students, active_loans, overdue_loans, pending_fines, loans_this_period, returns_this_period })
}

#[tauri::command]
fn get_loans_by_month(state: State<DbState>, year: i64) -> Result<Vec<MonthlyLoanCount>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT CAST(strftime('%m',loan_date) AS INTEGER), COUNT(*) FROM loans WHERE ano_letivo=?1 GROUP BY strftime('%m',loan_date) ORDER BY 1"
    ).map_err(|e| e.to_string())?;
    let counts = stmt.query_map(params![year], |r| Ok(MonthlyLoanCount { month: r.get(0)?, count: r.get(1)? }))
        .map_err(|e| e.to_string())?.filter_map(|c| c.ok()).collect();
    Ok(counts)
}

// ── Fines ─────────────────────────────────────────────────────────────────────

#[tauri::command]
fn list_fines(state: State<DbState>, ano_letivo: Option<i64>) -> Result<Vec<FineDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let today = today_str();
    let now = Local::now().year() as i64;
    let filter_year = ano_letivo.unwrap_or(now);

    let mut stmt = conn.prepare(
        "SELECT f.id, f.loan_id, l.ano_letivo, l.student_name, l.student_grade, l.student_class, l.student_phone,
                b.title, b.author, l.due_date,
                f.status, f.donated_book_title, f.donated_book_author, f.resolved_at, f.created_at
         FROM fines f JOIN loans l ON l.id=f.loan_id JOIN books b ON b.id=l.book_id
         WHERE l.ano_letivo=?1
         ORDER BY f.status DESC, f.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let fines = stmt.query_map(params![filter_year], |r| {
        let due_date: String = r.get(9)?;
        Ok(FineDetail {
            id: r.get(0)?, loan_id: r.get(1)?, ano_letivo: r.get(2)?,
            student_name: r.get(3)?, student_grade: r.get(4)?, student_class: r.get(5)?,
            student_phone: r.get(6)?, book_title: r.get(7)?, book_author: r.get(8)?,
            days_overdue: days_between(&due_date, &today).max(0),
            due_date, status: r.get(10)?,
            donated_book_title: r.get(11)?, donated_book_author: r.get(12)?,
            resolved_at: r.get(13)?, created_at: r.get(14)?,
        })
    }).map_err(|e| e.to_string())?.filter_map(|f| f.ok()).collect();
    Ok(fines)
}

#[tauri::command]
fn resolve_fine(state: State<DbState>, fine_id: i64, donated_book_title: String, donated_book_author: String) -> Result<(), String> {
    if donated_book_title.trim().is_empty() { return Err("Informe o título do livro doado.".to_string()); }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = now_str();
    conn.execute(
        "UPDATE fines SET status='resolved', donated_book_title=?1, donated_book_author=?2, resolved_at=?3 WHERE id=?4",
        params![donated_book_title.trim(), donated_book_author.trim(), now, fine_id],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO books (title,author,quantity,available_quantity,is_donation,created_at) VALUES (?1,?2,1,1,1,?3)",
        params![donated_book_title.trim(), donated_book_author.trim(), now],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Reports & Exports ─────────────────────────────────────────────────────────

#[tauri::command]
fn get_report_data(
    state: State<DbState>,
    ano_letivo: i64,
    month: Option<i64>,
    week: Option<i64>,
) -> Result<ReportData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    mark_overdue_internal(&conn).ok();
    let (week_start, week_end) = week.map(week_day_range).unwrap_or((1, 31));

    let period_label = match (month, week) {
        (Some(m), Some(w)) => {
            let months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
            format!("{} — Semana {} — {}", months[(m-1) as usize], w, ano_letivo)
        }
        (Some(m), None) => {
            let months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
            format!("{} de {}", months[(m-1) as usize], ano_letivo)
        }
        _ => format!("Ano Letivo {}", ano_letivo),
    };

    let total_loans: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE ano_letivo=?1 AND (?2 IS NULL OR CAST(strftime('%m',loan_date) AS INTEGER)=?2) AND (?3 IS NULL OR CAST(strftime('%d',loan_date) AS INTEGER) BETWEEN ?4 AND ?5)",
        params![ano_letivo, month, week, week_start, week_end], |r| r.get(0),
    ).unwrap_or(0);

    let returned_loans: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE ano_letivo=?1 AND status='returned' AND (?2 IS NULL OR CAST(strftime('%m',loan_date) AS INTEGER)=?2) AND (?3 IS NULL OR CAST(strftime('%d',loan_date) AS INTEGER) BETWEEN ?4 AND ?5)",
        params![ano_letivo, month, week, week_start, week_end], |r| r.get(0),
    ).unwrap_or(0);

    let overdue_loans: i64 = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE ano_letivo=?1 AND status='overdue' AND (?2 IS NULL OR CAST(strftime('%m',loan_date) AS INTEGER)=?2) AND (?3 IS NULL OR CAST(strftime('%d',loan_date) AS INTEGER) BETWEEN ?4 AND ?5)",
        params![ano_letivo, month, week, week_start, week_end], |r| r.get(0),
    ).unwrap_or(0);

    let fines_resolved: i64 = conn.query_row(
        "SELECT COUNT(*) FROM fines f JOIN loans l ON l.id=f.loan_id WHERE l.ano_letivo=?1 AND f.status='resolved' AND (?2 IS NULL OR CAST(strftime('%m',l.loan_date) AS INTEGER)=?2) AND (?3 IS NULL OR CAST(strftime('%d',l.loan_date) AS INTEGER) BETWEEN ?4 AND ?5)",
        params![ano_letivo, month, week, week_start, week_end], |r| r.get(0),
    ).unwrap_or(0);

    let mut stmt = conn.prepare(
        "SELECT l.id, l.ano_letivo, l.student_name, l.student_grade, l.student_class,
                l.student_phone, l.student_email,
                l.book_id, b.title, b.author,
                l.loan_date, l.due_date, l.return_date, l.renewed, l.status, l.created_at,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id) AS has_fine,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id AND f.status='resolved') AS fine_paid
         FROM loans l JOIN books b ON b.id=l.book_id
         WHERE l.ano_letivo=?1
           AND (?2 IS NULL OR CAST(strftime('%m',l.loan_date) AS INTEGER)=?2)
           AND (?3 IS NULL OR CAST(strftime('%d',l.loan_date) AS INTEGER) BETWEEN ?4 AND ?5)
         ORDER BY l.loan_date DESC"
    ).map_err(|e| e.to_string())?;

    let loans: Vec<LoanDetail> = stmt.query_map(
        params![ano_letivo, month, week, week_start, week_end],
        |r| Ok(LoanDetail {
            id: r.get(0)?, ano_letivo: r.get(1)?, student_name: r.get(2)?,
            student_grade: r.get(3)?, student_class: r.get(4)?, student_phone: r.get(5)?,
            student_email: r.get(6)?, book_id: r.get(7)?, book_title: r.get(8)?,
            book_author: r.get(9)?, loan_date: r.get(10)?, due_date: r.get(11)?,
            return_date: r.get(12)?, renewed: r.get(13)?, status: r.get(14)?,
            created_at: r.get(15)?,
            has_fine: r.get::<_, i64>(16)? > 0,
            fine_paid: r.get::<_, i64>(17)? > 0,
        }),
    ).map_err(|e| e.to_string())?.filter_map(|l| l.ok()).collect();

    Ok(ReportData { period_label, ano_letivo, total_loans, returned_loans, overdue_loans, fines_resolved, loans })
}

/// Export CSV with UTF-8 BOM so Excel opens it correctly with accents.
/// Column order: ID | Ano Letivo | Série | Turma | Aluno | Telefone | E-mail | Livro | Data Empréstimo | Data Devolução | Status | Multa Paga
#[tauri::command]
fn export_report_csv(
    state: State<DbState>,
    ano_letivo: i64,
    month: Option<i64>,
    week: Option<i64>,
) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let (week_start, week_end) = week.map(week_day_range).unwrap_or((1, 31));

    let mut stmt = conn.prepare(
        "SELECT l.id, l.ano_letivo, l.student_grade, l.student_class, l.student_name,
                l.student_phone, l.student_email, b.title,
                l.loan_date, l.due_date, l.status,
                (SELECT COUNT(*) FROM fines f WHERE f.loan_id=l.id AND f.status='resolved') AS fine_paid
         FROM loans l JOIN books b ON b.id=l.book_id
         WHERE l.ano_letivo=?1
           AND (?2 IS NULL OR CAST(strftime('%m',l.loan_date) AS INTEGER)=?2)
           AND (?3 IS NULL OR CAST(strftime('%d',l.loan_date) AS INTEGER) BETWEEN ?4 AND ?5)
         ORDER BY l.loan_date DESC"
    ).map_err(|e| e.to_string())?;

    let mut wtr = csv::WriterBuilder::new().from_writer(vec![]);
    wtr.write_record(&[
        "ID", "Ano Letivo", "Série", "Turma", "Aluno", "Telefone", "E-mail",
        "Livro", "Data Empréstimo", "Data Devolução", "Status", "Multa Paga",
    ]).map_err(|e| e.to_string())?;

    let status_label = |s: &str| match s {
        "active" => "Ativo".to_string(),
        "overdue" => "Em Atraso".to_string(),
        "returned" => "Devolvido".to_string(),
        _ => s.to_string(),
    };

    stmt.query_map(params![ano_letivo, month, week, week_start, week_end], |r| {
        Ok((
            r.get::<_, i64>(0)?.to_string(),
            r.get::<_, i64>(1)?.to_string(),
            format!("{}° Ano", r.get::<_, i64>(2)?),
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, Option<String>>(5)?.unwrap_or_default(),
            r.get::<_, Option<String>>(6)?.unwrap_or_default(),
            r.get::<_, String>(7)?,
            r.get::<_, String>(8)?,
            r.get::<_, String>(9)?,
            r.get::<_, String>(10)?,
            r.get::<_, i64>(11)?,
        ))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .for_each(|r| {
        let status_str = status_label(&r.10);
        let fine_paid = if r.11 > 0 { "Sim" } else { "Não" }.to_string();
        let _ = wtr.write_record(&[&r.0, &r.1, &r.2, &r.3, &r.4, &r.5, &r.6, &r.7, &r.8, &r.9, &status_str, &fine_paid]);
    });

    wtr.flush().map_err(|e| e.to_string())?;
    let bytes = wtr.into_inner().map_err(|e| e.to_string())?;
    let csv_str = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    // Prepend UTF-8 BOM so Excel recognises encoding
    Ok(format!("\u{FEFF}{}", csv_str))
}

// ─────────────────────────────────────────────────────────────── main ──────────

fn main() {
    let db_path = {
        let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        std::fs::create_dir_all(&app_dir).ok();
        app_dir.join("biblioteca.db")
    };
    let conn = Connection::open(&db_path).expect("Erro ao abrir banco de dados SQLite");
    init_db(&conn).expect("Erro ao inicializar esquema do banco de dados");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            check_first_run,
            create_user,
            login,
            list_users,
            delete_user,
            import_students_csv,
            list_students,
            delete_student,
            parse_books_csv,
            confirm_books_import,
            add_book,
            list_books,
            update_book,
            delete_book,
            list_genres,
            create_loan,
            return_book,
            renew_loan,
            mark_overdue_loans,
            list_loans,
            list_overdue_loans,
            get_dashboard_stats,
            get_loans_by_month,
            list_fines,
            resolve_fine,
            get_report_data,
            export_report_csv,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o aplicativo");
}
