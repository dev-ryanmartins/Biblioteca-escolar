// Mock de autenticação para desenvolvimento sem backend Tauri
import type { User } from "../types";

interface MockDB {
    users: Map<string, { password: string; user: User }>;
    students: Array<any>;
    books: Array<any>;
    loans: Array<any>;
    fines: Array<any>;
    isFirstRun: boolean;
}

const mockDB: MockDB = {
    users: new Map(),
    students: [],
    books: [],
    loans: [],
    fines: [],
    isFirstRun: true,
};

export async function checkFirstRun(): Promise<boolean> {
    return mockDB.isFirstRun;
}

export async function createUser(
    name: string,
    password: string,
    isAdmin: boolean
): Promise<User> {
    if (mockDB.users.has(name)) {
        throw new Error("Usuário já existe");
    }

    if (password.length < 4) {
        throw new Error("Senha deve ter no mínimo 4 caracteres");
    }

    const user: User = {
        id: mockDB.users.size + 1,
        name,
        is_admin: isAdmin,
        created_at: new Date().toISOString(),
    };

    mockDB.users.set(name, { password, user });
    mockDB.isFirstRun = false;

    return user;
}

export async function login(
    name: string,
    password: string
): Promise<User> {
    const entry = mockDB.users.get(name);

    if (!entry) {
        throw new Error("Usuário ou senha incorretos");
    }

    if (entry.password !== password) {
        throw new Error("Usuário ou senha incorretos");
    }

    return entry.user;
}

export async function markOverdueLoans(): Promise<void> {
    // Mock - não faz nada em ambiente de desenvolvimento
}

export async function handleGenericCommand(
    command: string,
    args?: Record<string, unknown>
): Promise<any> {
    // Mock data para desenvolvimento
    switch (command) {
        case "list_users":
            return Array.from(mockDB.users.values()).map((u) => u.user);

        case "delete_user": {
            const { id } = args as { id: number };
            const users = Array.from(mockDB.users.values());
            const userToDelete = users.find((u) => u.user.id === id);
            if (!userToDelete) throw new Error("Usuário não encontrado");
            mockDB.users.delete(userToDelete.user.name);
            return { success: true };
        }

        case "get_dashboard_stats":
            return {
                total_books: 0,
                total_students: 0,
                active_loans: 0,
                overdue_loans: 0,
                pending_fines: 0,
                loans_this_period: 0,
                returns_this_period: 0,
            };

        case "get_all_students":
            return mockDB.students;

        case "get_all_books":
            return mockDB.books;

        case "get_all_loans":
            return mockDB.loans;

        case "get_pending_fines":
            return mockDB.fines;

        case "get_all_users":
            return Array.from(mockDB.users.values()).map((u) => u.user);

        default:
            throw new Error(
                `Comando não implementado em modo mock: ${command}. Execute com Tauri para funcionalidade completa.`
            );
    }
}

