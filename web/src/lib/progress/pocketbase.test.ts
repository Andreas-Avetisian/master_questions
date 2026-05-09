import { describe, expect, it } from "vitest";
import { isUniqueConflict } from "./pocketbase";

describe("isUniqueConflict", () => {
  it("recognizes PocketBase nested unique validation errors", () => {
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
