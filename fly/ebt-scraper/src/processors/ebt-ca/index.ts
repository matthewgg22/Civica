/**
 * ebt-ca processor — California EBT Client Web Portal (www.ebt.ca.gov).
 *
 * The default processor for Civica's CA-first launch. Wraps the per-step
 * modules (login, parse-balance, parse-transactions) behind the `Processor`
 * interface defined in `src/processor.ts`.
 *
 * To add another processor (eWIC, Plaid CA, FIS direct), copy this folder
 * structure and register in `src/scrape.ts`. See plan §16.4.
 */

import type { Processor } from "../../processor.js";
import { loginEbtCa } from "./login.js";
import { parseEbtCaBalance } from "./parse-balance.js";
import { parseEbtCaTransactions } from "./parse-transactions.js";
import { detectEbtCaErrors } from "./errors.js";

export const ebtCaProcessor: Processor = {
  id: "ebt-ca",
  login: loginEbtCa,
  parseBalance: parseEbtCaBalance,
  parseTransactions: parseEbtCaTransactions,
  detectErrors: detectEbtCaErrors,
};
