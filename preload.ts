import { contextBridge } from "electron"

contextBridge.exposeInMainWorld("financeAPI", {
    ping: (): string => "pong from electron"
})