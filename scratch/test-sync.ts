import { syncLeavesFromGoogleSheet } from "../src/server/services/leave-sync";

async function main() {
  try {
    console.log("Starting sync test...");
    // We need to modify the service to return or log records, 
    // but for now let's just assume we can see them if we add a log in the service temporarily.
    // Or just run it and see.
    const result = await syncLeavesFromGoogleSheet();
    console.log("Sync result:", result);
  } catch (err) {
    console.error("Sync failed with error:", err);
  }
}

main();
