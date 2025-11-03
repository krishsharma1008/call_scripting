/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "pg";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const pg = new Client({ connectionString: process.env.DATABASE_URL });

async function profileText(row: any) {
  return [
    `${row.name} in ${row.city}`,
    `plan: ${row.plan}`,
    `last_service: ${row.last_service_date}`,
    `avg_order: $${row.avg_order_value}`,
    `dryer_age_years: ${row.dryer_age_years}`,
    `has_pets: ${row.has_pets}`,
    `notes: ${row.notes}`,
  ].join(" | ");
}

async function main() {
  await pg.connect();
  const { rows } = await pg.query(
    `SELECT * FROM leads WHERE embedding IS NULL`
  );
  if (!rows.length) {
    console.log("No rows to embed");
    await pg.end();
    return;
  }

  for (const r of rows) {
    const text = await profileText(r);
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vec = emb.data[0].embedding as number[];
    // pgvector expects array-literal syntax: [x,y,z,...]
    const vecLiteral = "[" + vec.join(",") + "]";
    await pg.query(`UPDATE leads SET embedding = $1 WHERE id = $2`, [
      vecLiteral,
      r.id,
    ]);
    console.log("Embedded", r.id);
  }

  await pg.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
