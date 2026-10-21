import type { IpcMainInvokeEvent } from "electron"
import { assertSafeIpcArguments, assertTrustedIpcSender } from "./secureIpc"

const productionUrl = "file:///app/renderer/dist/index.html"

function senderFor(url: string, childFrame = false) {
    const mainFrame = { url }
    const sender = { mainFrame }
    const event = {
        sender,
        senderFrame: childFrame ? { url } : mainFrame,
    } as unknown as IpcMainInvokeEvent
    const window = { webContents: sender } as Electron.BrowserWindow
    return { event, window }
}

describe("IPC boundary", () => {
    test("allows only the app window's main frame at a trusted URL", () => {
        const development = senderFor("http://127.0.0.1:5173/")
        expect(() => assertTrustedIpcSender(development.event, development.window, true, productionUrl)).not.toThrow()

        const production = senderFor(productionUrl)
        expect(() => assertTrustedIpcSender(production.event, production.window, false, productionUrl)).not.toThrow()

        expect(() => assertTrustedIpcSender(development.event, null, true, productionUrl)).toThrow("Unauthorized IPC sender")
        expect(() => assertTrustedIpcSender(development.event, production.window, true, productionUrl)).toThrow("Unauthorized IPC sender")

        const child = senderFor("http://127.0.0.1:5173/", true)
        expect(() => assertTrustedIpcSender(child.event, child.window, true, productionUrl)).toThrow("child frames")

        for (const url of ["http://evil.example:5173/", "http://localhost:5174/"]) {
            const untrusted = senderFor(url)
            expect(() => assertTrustedIpcSender(untrusted.event, untrusted.window, true, productionUrl)).toThrow("Unauthorized IPC origin")
        }

        const otherFile = senderFor("file:///app/renderer/dist/other.html")
        expect(() => assertTrustedIpcSender(otherFile.event, otherFile.window, false, productionUrl)).toThrow("Unauthorized IPC origin")
    })

    test("accepts the dates and sets used by report queries", () => {
        expect(() => assertSafeIpcArguments([{
            fromDate: new Date("2026-10-21"),
            types: new Set(["withdraw", "deposit"]),
            accountId: 1,
        }])).not.toThrow()
    })

    test("rejects cyclic sets, deeply nested payloads, and unsafe keys", () => {
        const cyclic = new Set<unknown>()
        cyclic.add(cyclic)
        expect(() => assertSafeIpcArguments([cyclic])).toThrow("Cyclic IPC payload")

        let nested: unknown = "value"
        for (let index = 0; index < 9; index++) nested = new Set([nested])
        expect(() => assertSafeIpcArguments([nested])).toThrow("too deeply nested")

        expect(() => assertSafeIpcArguments([JSON.parse('{"__proto__":1}')])).toThrow("Unsafe IPC object key")
    })

    test("rejects oversized and non-finite arguments", () => {
        expect(() => assertSafeIpcArguments(["x".repeat(100_001)])).toThrow("too large")
        expect(() => assertSafeIpcArguments([Number.POSITIVE_INFINITY])).toThrow("must be finite")
    })

    test("limits total work across nested branches and all arguments", () => {
        const strings = Array(11).fill("x".repeat(100_000))
        expect(() => assertSafeIpcArguments(strings)).toThrow("too much text")

        const manyValues = Array.from({ length: 51 }, () => Array(1_000).fill(0))
        expect(() => assertSafeIpcArguments([manyValues])).toThrow("too many values")
    })
})
