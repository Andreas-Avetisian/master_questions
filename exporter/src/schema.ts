import Ajv from "ajv";

const schema = {
  type: "object",
  required: ["version", "generatedAt", "questions"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", const: 1 },
    generatedAt: { type: "string", minLength: 1 },
    questions: {
      type: "array",
      items: {
        type: "object",
        required: [
          "qid",
          "courses",
          "question",
          "answer_markdown",
          "answer_is_empty",
          "sources",
          "images",
        ],
        additionalProperties: false,
        properties: {
          qid: { type: "integer" },
          courses: {
            type: "array",
            items: { type: "string", minLength: 1 },
            minItems: 1,
          },
          question: { type: "string", minLength: 1 },
          answer_markdown: { type: "string" },
          answer_is_empty: { type: "boolean" },
          sources: {
            type: "array",
            items: {
              type: "object",
              required: ["file", "pages_raw"],
              additionalProperties: false,
              properties: {
                file: { type: "string" },
                pages_raw: { type: "string" },
              },
            },
            minItems: 1,
          },
          images: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true });
export const validateExport = ajv.compile(schema);
