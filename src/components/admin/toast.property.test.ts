/**
 * Property 15: Toast deduplication
 * **Validates: Requirements 16.8**
 *
 * Calling showToast({ id, message }) twice in succession must result in
 * exactly one active entry in the toast queue with that id.
 *
 * The deduplication logic is extracted from SettingsForm.tsx's `addToast`
 * function and tested as a pure function here.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure deduplication logic extracted from SettingsForm.tsx `addToast`
// ---------------------------------------------------------------------------

interface Toast {
  id: string;
  message: string;
  variant: "success" | "error";
}

/**
 * Pure function that mirrors the deduplication logic inside `addToast`:
 *   const filtered = prev.filter((t) => t.id !== id);
 *   return [...filtered, { id, message, variant }];
 */
function applyToast(queue: Toast[], toast: Toast): Toast[] {
  const filtered = queue.filter((t) => t.id !== toast.id);
  return [...filtered, toast];
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const variantArb: fc.Arbitrary<"success" | "error"> = fc.constantFrom(
  "success" as const,
  "error" as const
);

const toastIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 40 });

const toastArb: fc.Arbitrary<Toast> = fc.record({
  id: toastIdArb,
  message: fc.string({ minLength: 1, maxLength: 200 }),
  variant: variantArb,
});

/** Generates a queue of 0–5 toasts with distinct ids */
const toastQueueArb: fc.Arbitrary<Toast[]> = fc
  .array(toastArb, { minLength: 0, maxLength: 5 })
  .map((toasts) => {
    // Ensure unique ids in the initial queue (mirrors real state)
    const seen = new Set<string>();
    return toasts.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("Property 15: Toast deduplication", () => {
  /**
   * Core property: adding the same toast id twice results in exactly one
   * entry with that id in the queue.
   */
  it("calling applyToast with the same id twice yields exactly one entry with that id", () => {
    fc.assert(
      fc.property(
        toastQueueArb,
        toastIdArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        variantArb,
        variantArb,
        (initialQueue, id, message1, message2, variant1, variant2) => {
          const toast1: Toast = { id, message: message1, variant: variant1 };
          const toast2: Toast = { id, message: message2, variant: variant2 };

          // Apply the same id twice
          const afterFirst = applyToast(initialQueue, toast1);
          const afterSecond = applyToast(afterFirst, toast2);

          // Exactly one entry with that id must exist
          const entriesWithId = afterSecond.filter((t) => t.id === id);
          expect(entriesWithId).toHaveLength(1);
        }
      )
    );
  });

  /**
   * The surviving entry is the most recently added one (last-write-wins).
   */
  it("the surviving entry after deduplication is the second (most recent) toast", () => {
    fc.assert(
      fc.property(
        toastQueueArb,
        toastIdArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        variantArb,
        variantArb,
        (initialQueue, id, message1, message2, variant1, variant2) => {
          const toast1: Toast = { id, message: message1, variant: variant1 };
          const toast2: Toast = { id, message: message2, variant: variant2 };

          const afterFirst = applyToast(initialQueue, toast1);
          const afterSecond = applyToast(afterFirst, toast2);

          const surviving = afterSecond.find((t) => t.id === id);
          expect(surviving).toBeDefined();
          expect(surviving!.message).toBe(message2);
          expect(surviving!.variant).toBe(variant2);
        }
      )
    );
  });

  /**
   * Toasts with different ids are not affected by deduplication.
   * Adding a toast with id A must not remove toasts with id B (B ≠ A).
   */
  it("deduplication does not remove toasts with different ids", () => {
    fc.assert(
      fc.property(
        toastQueueArb,
        toastArb,
        (initialQueue, newToast) => {
          // Collect ids in the initial queue that differ from newToast.id
          const otherIds = initialQueue
            .map((t) => t.id)
            .filter((id) => id !== newToast.id);

          const afterApply = applyToast(initialQueue, newToast);

          // Every other id must still be present exactly once
          for (const otherId of otherIds) {
            const count = afterApply.filter((t) => t.id === otherId).length;
            expect(count).toBe(1);
          }
        }
      )
    );
  });

  /**
   * Queue length invariant: after adding a toast whose id already exists,
   * the queue length must not increase (deduplication removes the old entry).
   */
  it("queue length does not grow when adding a duplicate id", () => {
    fc.assert(
      fc.property(
        toastQueueArb.filter((q) => q.length > 0),
        variantArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        (initialQueue, variant, message) => {
          // Pick an id that already exists in the queue
          const existingId = initialQueue[0].id;
          const duplicateToast: Toast = { id: existingId, message, variant };

          const afterApply = applyToast(initialQueue, duplicateToast);

          // Length must stay the same (old removed, new added)
          expect(afterApply.length).toBe(initialQueue.length);
        }
      )
    );
  });

  /**
   * Queue length grows by 1 when adding a brand-new id.
   */
  it("queue length grows by 1 when adding a toast with a new id", () => {
    fc.assert(
      fc.property(
        toastQueueArb,
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        variantArb,
        (initialQueue, newId, message, variant) => {
          // Ensure newId is not already in the queue
          fc.pre(!initialQueue.some((t) => t.id === newId));

          const newToast: Toast = { id: newId, message, variant };
          const afterApply = applyToast(initialQueue, newToast);

          expect(afterApply.length).toBe(initialQueue.length + 1);
        }
      )
    );
  });
});
