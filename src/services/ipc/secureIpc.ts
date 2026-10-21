import type { IpcMainInvokeEvent } from "electron"

const MAX_DEPTH = 8
const MAX_KEYS = 1_000
const MAX_ARRAY_LENGTH = 10_000
const MAX_STRING_LENGTH = 100_000
const MAX_TOTAL_STRING_LENGTH = 1_000_000
const MAX_TOTAL_NODES = 50_000

type PayloadBudget = { nodes: number; stringLength: number }

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function validatePayload(value: unknown, depth: number, seen: Set<object>, budget: PayloadBudget): void {
    if (depth > MAX_DEPTH) throw new Error("IPC payload is too deeply nested")
    budget.nodes++
    if (budget.nodes > MAX_TOTAL_NODES) throw new Error("IPC payload has too many values")
    if (value === null || value === undefined) return

    if (typeof value === "string") {
        if (value.length > MAX_STRING_LENGTH) {
            throw new Error("IPC string payload is too large")
        }
        budget.stringLength += value.length
        if (budget.stringLength > MAX_TOTAL_STRING_LENGTH) {
            throw new Error("IPC payload contains too much text")
        }
        return
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error("IPC numeric payload must be finite")
        return
    }

    if (typeof value === "boolean" || typeof value === "bigint") return

    if (typeof value !== "object") {
        throw new Error("Unsupported IPC payload type")
    }

    if (seen.has(value)) throw new Error("Cyclic IPC payload is not allowed")
    if (value instanceof Date) return
    seen.add(value)

    if (value instanceof Set) {
        if (value.size > MAX_ARRAY_LENGTH) throw new Error("IPC set payload is too large")
        for (const item of value) validatePayload(item, depth + 1, seen, budget)
    } else if (Array.isArray(value)) {
        if (value.length > MAX_ARRAY_LENGTH) throw new Error("IPC array payload is too large")
        for (const item of value) validatePayload(item, depth + 1, seen, budget)
    } else if (isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length > MAX_KEYS) throw new Error("IPC object payload has too many keys")
        for (const key of keys) {
            if (key === "__proto__" || key === "prototype" || key === "constructor") {
                throw new Error("Unsafe IPC object key")
            }
            budget.stringLength += key.length
            if (budget.stringLength > MAX_TOTAL_STRING_LENGTH) {
                throw new Error("IPC payload contains too much text")
            }
            validatePayload(value[key], depth + 1, seen, budget)
        }
    } else {
        throw new Error("Unsupported IPC object payload")
    }

    seen.delete(value)
}

export function assertTrustedIpcSender(
    event: IpcMainInvokeEvent,
    expectedWindow: Electron.BrowserWindow | null,
    isDevelopment: boolean,
    expectedProductionUrl: string,
): void {
    if (!expectedWindow || event.sender !== expectedWindow.webContents) {
        throw new Error("Unauthorized IPC sender")
    }

    if (event.senderFrame !== event.sender.mainFrame) {
        throw new Error("IPC calls from child frames are not allowed")
    }

    const url = new URL(event.senderFrame.url)
    const trustedOrigin = isDevelopment
        ? (url.protocol === "http:" &&
            (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
            url.port === "5173")
        : url.href === expectedProductionUrl

    if (!trustedOrigin) throw new Error("Unauthorized IPC origin")
}

export function assertSafeIpcArguments(args: unknown[]): void {
    const seen = new Set<object>()
    const budget: PayloadBudget = { nodes: 0, stringLength: 0 }
    for (const arg of args) validatePayload(arg, 0, seen, budget)
}
