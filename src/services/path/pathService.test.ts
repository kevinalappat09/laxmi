jest.mock("electron", () => ({
    app: { getPath: () => "/mock/appData", isPackaged: true },
}));

import path from "path";
import { getProfileDirectory, getProfilesDirectory } from "./pathService";

describe("getProfileDirectory", () => {
    test("keeps a legacy profile name inside the profiles directory", () => {
        expect(getProfileDirectory("Old Profile")).toBe(
            path.join(getProfilesDirectory(), "Old Profile")
        );
    });

    test.each(["..", "../outside", "nested/profile", ".", "", "/tmp/outside"])(
        "rejects a profile path that is not one direct child: %s",
        (name) => {
            expect(() => getProfileDirectory(name)).toThrow("Invalid profile name.");
        }
    );
});
