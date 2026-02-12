describe("environmentService", () => {
    const OLD_ENV = process.env;

    // stores a copy of the old environment and restores it after the test.
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it("should return true if in development mode", () => {
        process.env.NODE_ENV = "development";
        const { isDev } = require("./environmentService");
        expect(isDev()).toBe(true);
    });

    it("should return false if in production mode", () => {
        process.env.NODE_ENV = "production";
        const { isDev } = require("./environmentService");
        expect(isDev()).toBe(false);
    });

    it("should return false if NODE_ENV is undefined", () => {
        delete process.env.NODE_ENV;
        const { isDev } = require("./environmentService");
        expect(isDev()).toBe(false);
    });
});
