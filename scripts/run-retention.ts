/** Applies the data-retention policy (can be scheduled; also available as a button in Settings). */
import { runRetention } from "../src/server/services/admin-orders";

runRetention().then((n) => console.log(`Anonymised ${n} orders.`)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
