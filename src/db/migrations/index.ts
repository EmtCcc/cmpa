import type { Migration } from "../migrate.js";
import { migration as m001 } from "./001_initial_schema.js";
import { migration as m002 } from "./002_agent_registry_fields.js";
import { migration as m003 } from "./003_task_sub_states.js";
import { migration as m004 } from "./004_cron_schedules.js";
import { migration as m005 } from "./005_task_output_handoff.js";

export const migrations: Migration[] = [m001, m002, m003, m004, m005];
