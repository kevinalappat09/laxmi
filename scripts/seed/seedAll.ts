/**
 * @module seedAll
 * @description Electron entrypoint that seeds all development test profiles.
 * @stability internal
 *
 * Run after compile:
 *   npm run seed
 *
 * Or a single profile:
 *   npm run seed:txn
 *   npm run seed:assets
 *   npm run seed:credit
 */

import { app } from "electron";
import { createServices, PROFILE_NAMES, quitElectron, runSeedStep } from "./seedUtils";
import { seedTxnBudgetProfile } from "./seedTxnBudget";
import { seedAssetsSipProfile } from "./seedAssetsSip";
import { seedCreditCardProfile } from "./seedCreditCard";

type Target = "all" | "txn" | "assets" | "credit";

function parseTarget(): Target {
    const arg = (process.argv.find((a) => a.startsWith("--profile=")) ?? "")
        .replace("--profile=", "")
        .toLowerCase();
    if (arg === "txn" || arg === "txnbudget" || arg === PROFILE_NAMES.txnBudget.toLowerCase()) {
        return "txn";
    }
    if (arg === "assets" || arg === "assetssip" || arg === PROFILE_NAMES.assetsSip.toLowerCase()) {
        return "assets";
    }
    if (arg === "credit" || arg === "creditcard" || arg === PROFILE_NAMES.creditCard.toLowerCase()) {
        return "credit";
    }
    return "all";
}

async function main(): Promise<void> {
    await app.whenReady();

    const target = parseTarget();
    const services = createServices();

    console.log(`Laxmi seed — target=${target} (dev data under Laxmi-Dev)`);
    console.log(`  packaged=${app.isPackaged}`);

    try {
        if (target === "all" || target === "txn") {
            await runSeedStep(`Seed ${PROFILE_NAMES.txnBudget}`, () =>
                seedTxnBudgetProfile(services)
            );
        }
        if (target === "all" || target === "assets") {
            await runSeedStep(`Seed ${PROFILE_NAMES.assetsSip}`, () =>
                seedAssetsSipProfile(services)
            );
        }
        if (target === "all" || target === "credit") {
            await runSeedStep(`Seed ${PROFILE_NAMES.creditCard}`, () =>
                seedCreditCardProfile(services)
            );
        }

        console.log("All requested profiles seeded.");
        console.log(
            `Open Laxmi (npm run dev) and select: ${Object.values(PROFILE_NAMES).join(", ")}`
        );
        await quitElectron(0);
    } catch (err) {
        console.error(err);
        await quitElectron(1);
    }
}

main().catch(async (err) => {
    console.error(err);
    await quitElectron(1);
});
