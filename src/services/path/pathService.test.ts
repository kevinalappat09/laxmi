const path = require("path");

const mockIsDev = jest.fn<boolean, []>();

jest.mock("../environment/environmentService", () => ({
    isDev: () => mockIsDev(),
}));

describe("pathService", () => {
    beforeEach(() => {
        jest.resetModules();
        mockIsDev.mockReset();
    });

    it("should resolve the correct base app data path for Windows", () => {
        const { getBaseAppDataPathFor } = require("./pathService");

        const homeDir = "C:\\\\Users\\\\TestUser";
        const basePath = getBaseAppDataPathFor("win32", homeDir);

        const expected = path.join(homeDir, "AppData", "Roaming");
        expect(basePath).toBe(expected);
    });

    it("should resolve the correct base app data path for macOS", () => {
        const { getBaseAppDataPathFor } = require("./pathService");

        const homeDir = "/Users/testuser";
        const basePath = getBaseAppDataPathFor("darwin", homeDir);

        const expected = path.join(homeDir, "Library", "Application Support");
        expect(basePath).toBe(expected);
    });

    it("should resolve the correct base app data path for Linux", () => {
        const { getBaseAppDataPathFor } = require("./pathService");

        const homeDir = "/home/testuser";
        const basePath = getBaseAppDataPathFor("linux", homeDir);

        const expected = path.join(homeDir, ".config");
        expect(basePath).toBe(expected);
    });

    it("should append Laxmi-Dev to the root data directory in development", () => {
        mockIsDev.mockReturnValue(true);

        const { getRootDataDirectory } = require("./pathService");
        const rootPath = getRootDataDirectory();

        expect(path.basename(rootPath)).toBe("Laxmi-Dev");
    });

    it("should append Laxmi to the root data directory in production", () => {
        mockIsDev.mockReturnValue(false);

        const { getRootDataDirectory } = require("./pathService");
        const rootPath = getRootDataDirectory();

        expect(path.basename(rootPath)).toBe("Laxmi");
    });

    it("should resolve the global_preferences.json path under the root data directory", () => {
        mockIsDev.mockReturnValue(true);

        const { getGlobalPreferencesPath } = require("./pathService");
        const globalPrefsPath = getGlobalPreferencesPath();

        expect(path.basename(globalPrefsPath)).toBe("global_preferences.json");
    });

    it("should resolve the profile directory and preferences.json path for a profile", () => {
        mockIsDev.mockReturnValue(true);

        const profileName = "TestProfile";

        const { getProfileDirectory, getProfilePreferencesPath } = require("./pathService");

        const profileDir = getProfileDirectory(profileName);
        expect(path.basename(profileDir)).toBe(profileName);

        const profilePrefsPath = getProfilePreferencesPath(profileName);
        expect(path.basename(profilePrefsPath)).toBe("preferences.json");
        expect(path.basename(path.dirname(profilePrefsPath))).toBe(profileName);
    });
});

