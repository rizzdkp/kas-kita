"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { versionSchema, parseInput } from "@/server/mutations/_shared";
import { createRecurringRule, deleteRecurringRule, updateRecurringRule, type RecurringRuleFieldsInput } from "@/server/mutations/recurring";
import { runAction, type ActionResult } from "./result";

export type { RecurringRuleFieldsInput };

export async function createRecurringRuleAction(fields: RecurringRuleFieldsInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await createRecurringRule(viewer, fields);
    return { id: row.id };
  });
}

const refSchema = z.object({ id: z.uuid(), version: versionSchema });

export async function updateRecurringRuleAction(input: {
  id: string;
  version: number;
  fields: RecurringRuleFieldsInput;
}): Promise<ActionResult<{ id: string; version: number }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { id, version } = parseInput(refSchema, { id: input.id, version: input.version });
    const row = await updateRecurringRule(viewer, { id, version, fields: input.fields });
    return { id: row.id, version: row.version };
  });
}

export async function deleteRecurringRuleAction(input: { id: string; version: number }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const row = await deleteRecurringRule(viewer, parseInput(refSchema, input));
    return { id: row.id };
  });
}
