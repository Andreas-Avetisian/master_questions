import { describe, expect, it } from "vitest";
import type { ClientResponseError } from "pocketbase";
import { isUniqueConflict } from "./pocketbase";

describe("isUniqueConflict", () => {
  it("recognizes PocketBase nested unique validation errors", () => {
    const err = Object.assign(new Error("Failed to create record."), {
      status: 400,
      data: {
        data: {
          qid: { message: "Value must be unique" },
          user: { message: "Value must be unique" },
        },
      },
    }) as unknown as ClientResponseError;

    expect(isUniqueConflict(err)).toBe(true);
  });

  it("recognizes the raw production log shape", () => {
    expect(
      isUniqueConflict({
        status: 400,
        message: "Failed to create record.",
        data: {
          data: {
            qid: { message: "Value must be unique" },
            user: { message: "Value must be unique" },
          },
        },
      }),
    ).toBe(true);
  });
});
