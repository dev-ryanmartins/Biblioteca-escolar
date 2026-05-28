// Wrapper para usar Tauri ou mock quando nao disponivel.
import { invoke as tauriInvoke } from "@tauri-apps/api/tauri";
import * as mock from "./mock";

function isTauriAvailable() {
    return typeof window !== "undefined" && "__TAURI_IPC__" in window;
}

export async function invoke<T = unknown>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    if (!isTauriAvailable()) {
        return mockInvoke<T>(command, args);
    }

    try {
        return await tauriInvoke<T>(command, args);
    } catch {
        return mockInvoke<T>(command, args);
    }
}

async function mockInvoke<T = unknown>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    switch (command) {
        case "check_first_run":
            return (await mock.checkFirstRun()) as T;

        case "create_user": {
            const { name, password, isAdmin } = args as {
                name: string;
                password: string;
                isAdmin: boolean;
            };
            return (await mock.createUser(name, password, isAdmin)) as T;
        }

        case "login": {
            const { name, password } = args as {
                name: string;
                password: string;
            };
            return (await mock.login(name, password)) as T;
        }

        case "mark_overdue_loans":
            return (await mock.markOverdueLoans()) as T;

        default:
            return (await mock.handleGenericCommand(command, args)) as T;
    }
}
