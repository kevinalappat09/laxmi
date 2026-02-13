import * as fs from "fs/promises";

const mockGetGlobalPreferencesPath = jest.fn<string, []>();
const mockReadFile = jest.fn<Promise<string>, [string, { encoding: string }]>();
const mockWriteFile = jest.fn<Promise<void>, [string, string, { encoding: string }]>();

jest.mock("../path/pathService", () => ({
    getGlobalPreferencesPath: () => mockGetGlobalPreferencesPath(),
}));

jest.mock("fs/promises", () => ({
    readFile: (path: string, options: { encoding: string }) => mockReadFile(path, options),
    writeFile: (path: string, data: string, options: { encoding: string }) =>
        mockWriteFile(path, data, options),
}));

describe("globalPreferencesService", () => {
    const TEST_PREFS_PATH = "/test/path/global_preferences.json";

    beforeEach(() => {
        jest.resetModules();
        mockGetGlobalPreferencesPath.mockReturnValue(TEST_PREFS_PATH);
        mockReadFile.mockReset();
        mockWriteFile.mockReset();
    });

    describe("loadPreferences", () => {
        it("should return default preferences when file does not exist", async () => {
            const error = new Error("File not found") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            mockReadFile.mockRejectedValue(error);

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: null });
            expect(mockReadFile).toHaveBeenCalledWith(TEST_PREFS_PATH, { encoding: "utf-8" });
        });

        it("should load existing valid preferences with last_opened_profile", async () => {
            const fileContent = JSON.stringify({ last_opened_profile: "user1" });
            mockReadFile.mockResolvedValue(fileContent);

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: "user1" });
        });

        it("should ignore unknown fields and only return last_opened_profile", async () => {
            const fileContent = JSON.stringify({
                last_opened_profile: "user1",
                theme: "dark",
                unknownField: "value",
            });
            mockReadFile.mockResolvedValue(fileContent);

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: "user1" });
        });

        it("should return default when last_opened_profile key is missing", async () => {
            const fileContent = JSON.stringify({ theme: "dark" });
            mockReadFile.mockResolvedValue(fileContent);

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: null });
        });

        it("should return default preferences when file contains invalid JSON", async () => {
            mockReadFile.mockResolvedValue("{ invalid json");

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: null });
        });

        it("should normalize invalid last_opened_profile type to null", async () => {
            const fileContent = JSON.stringify({ last_opened_profile: 123 });
            mockReadFile.mockResolvedValue(fileContent);

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: null });
        });

        it("should return default preferences when JSON is not an object", async () => {
            mockReadFile.mockResolvedValue('"not an object"');

            const { loadPreferences } = require("./globalPreferencesService");
            const result = await loadPreferences();

            expect(result).toEqual({ last_opened_profile: null });
        });

        it("should propagate read errors that are not ENOENT", async () => {
            const error = new Error("Permission denied") as NodeJS.ErrnoException;
            error.code = "EACCES";
            mockReadFile.mockRejectedValue(error);

            const { loadPreferences } = require("./globalPreferencesService");

            await expect(loadPreferences()).rejects.toThrow("Permission denied");
        });
    });

    describe("savePreferences", () => {
        it("should write preferences directly to file", async () => {
            mockWriteFile.mockResolvedValue(undefined);

            const { savePreferences } = require("./globalPreferencesService");
            await savePreferences({ last_opened_profile: "user1" });

            expect(mockWriteFile).toHaveBeenCalledWith(
                TEST_PREFS_PATH,
                JSON.stringify({ last_opened_profile: "user1" }, null, 2),
                { encoding: "utf-8" }
            );
        });

        it("should overwrite file with only the provided preferences", async () => {
            mockWriteFile.mockResolvedValue(undefined);

            const { savePreferences } = require("./globalPreferencesService");
            await savePreferences({ last_opened_profile: "user2" });

            const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(writtenContent).toEqual({ last_opened_profile: "user2" });
            expect(writtenContent.theme).toBeUndefined();
        });

        it("should propagate write errors", async () => {
            const error = new Error("Permission denied") as NodeJS.ErrnoException;
            error.code = "EACCES";
            mockWriteFile.mockRejectedValue(error);

            const { savePreferences } = require("./globalPreferencesService");

            await expect(savePreferences({ last_opened_profile: "user1" })).rejects.toThrow(
                "Permission denied"
            );
        });
    });

    describe("getLastOpenedProfile", () => {
        it("should return last_opened_profile from file", async () => {
            const fileContent = JSON.stringify({ last_opened_profile: "user1" });
            mockReadFile.mockResolvedValue(fileContent);

            const { getLastOpenedProfile } = require("./globalPreferencesService");
            const result = await getLastOpenedProfile();

            expect(result).toBe("user1");
        });

        it("should return null when last_opened_profile is null", async () => {
            const fileContent = JSON.stringify({ last_opened_profile: null });
            mockReadFile.mockResolvedValue(fileContent);

            const { getLastOpenedProfile } = require("./globalPreferencesService");
            const result = await getLastOpenedProfile();

            expect(result).toBeNull();
        });

        it("should return null when file does not exist", async () => {
            const error = new Error("File not found") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            mockReadFile.mockRejectedValue(error);

            const { getLastOpenedProfile } = require("./globalPreferencesService");
            const result = await getLastOpenedProfile();

            expect(result).toBeNull();
        });
    });

    describe("setLastOpenedProfile", () => {
        it("should set last_opened_profile and save", async () => {
            mockWriteFile.mockResolvedValue(undefined);

            const { setLastOpenedProfile } = require("./globalPreferencesService");
            await setLastOpenedProfile("user2");

            const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(writtenContent).toEqual({ last_opened_profile: "user2" });
        });

        it("should set last_opened_profile to null", async () => {
            mockWriteFile.mockResolvedValue(undefined);

            const { setLastOpenedProfile } = require("./globalPreferencesService");
            await setLastOpenedProfile(null);

            const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
            expect(writtenContent).toEqual({ last_opened_profile: null });
        });

        it("should propagate errors from save", async () => {
            const error = new Error("Write failed") as NodeJS.ErrnoException;
            error.code = "EACCES";
            mockWriteFile.mockRejectedValue(error);

            const { setLastOpenedProfile } = require("./globalPreferencesService");

            await expect(setLastOpenedProfile("user2")).rejects.toThrow("Write failed");
        });
    });

    describe("resetPreferences", () => {
        it("should overwrite file with default preferences", async () => {
            mockWriteFile.mockResolvedValue(undefined);

            const { resetPreferences } = require("./globalPreferencesService");
            await resetPreferences();

            expect(mockWriteFile).toHaveBeenCalledWith(
                TEST_PREFS_PATH,
                JSON.stringify({ last_opened_profile: null }, null, 2),
                { encoding: "utf-8" }
            );
        });

        it("should propagate write errors", async () => {
            const error = new Error("Permission denied") as NodeJS.ErrnoException;
            error.code = "EACCES";
            mockWriteFile.mockRejectedValue(error);

            const { resetPreferences } = require("./globalPreferencesService");

            await expect(resetPreferences()).rejects.toThrow("Permission denied");
        });
    });
});
