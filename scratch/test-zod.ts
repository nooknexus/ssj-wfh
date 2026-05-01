import { z } from "zod";

const schema = z.object({
  settings: z.record(z.string())
});

console.log("Schema:", schema);
console.log("Has _zod:", (schema as any)._zod);
console.log("Type:", typeof schema);
