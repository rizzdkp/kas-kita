"use server";

import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { createValuation, deleteValuation, updateValuation, type ValuationRow } from "@/server/mutations/investments";
import { parseInput } from "@/server/mutations/_shared";
import { runAction, type ActionResult } from "./result";

const valuationFields = z.object({
  valuedOn: z.string(),
  marketValue: z.bigint(),
  note: z.string().nullable(),
});
export type ValuationFormInput = z.infer<typeof valuationFields>;

const idVersion = z.object({ id: z.uuid(), version: z.number().int().positive() });

export async function createValuationAction(input: ValuationFormInput & { accountId: string }): Promise<ActionResult<ValuationRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return createValuation(viewer, parseInput(valuationFields.extend({ accountId: z.uuid() }), input));
  });
}

export async function updateValuationAction(input: {
  id: string;
  version: number;
  patch: ValuationFormInput;
}): Promise<ActionResult<ValuationRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return updateValuation(viewer, parseInput(idVersion.extend({ patch: valuationFields }), input));
  });
}

export async function deleteValuationAction(input: { id: string; version: number }): Promise<ActionResult<ValuationRow>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return deleteValuation(viewer, parseInput(idVersion, input));
  });
}
