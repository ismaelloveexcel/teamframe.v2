import { runPhase4Stabilization } from "./phase4-stabilization";

void runPhase4Stabilization()
  .then((result) => {
    if (!result.pass) {
      console.error("determinism-enforcement: FAIL");
      console.error(JSON.stringify(result.determinism.checks, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log("determinism-enforcement: PASS");
  })
  .catch((error) => {
    console.error("determinism-enforcement crashed");
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
