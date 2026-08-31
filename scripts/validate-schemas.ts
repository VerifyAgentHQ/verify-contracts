import * as Ajv2020Module from "ajv/dist/2020.js";
import * as AddFormatsModule from "ajv-formats";
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

type Validator = {
  addSchema(schema: object): void;
  compile(schema: object): unknown;
};
type AjvConstructor = new (options: object) => Validator;
const Ajv2020 = (Ajv2020Module as unknown as { default: AjvConstructor })
  .default;
const addFormats = (
  AddFormatsModule as unknown as { default: (instance: Validator) => void }
).default;
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const files = [];
for await (const file of glob("schemas/**/*.schema.json")) files.push(file);
const loadedSchemas = [] as Array<{ file: string; schema: object }>;
for (const file of files) {
  const schema = JSON.parse(await readFile(file, "utf8")) as object;
  const metadata = schema as { $schema?: unknown; $id?: unknown };
  if (metadata.$schema !== "https://json-schema.org/draft/2020-12/schema")
    throw new Error(`${file}: unexpected $schema`);
  if (
    typeof metadata.$id !== "string" ||
    !metadata.$id.startsWith("https://contracts.verifyagent.dev/")
  )
    throw new Error(`${file}: invalid $id`);
  loadedSchemas.push({ file, schema });
}
for (const { schema } of loadedSchemas) ajv.addSchema(schema);
for (const { schema } of loadedSchemas) ajv.compile(schema);
console.log(`Validated ${files.length} JSON Schemas.`);
