import { getTagNameById, getTag } from "@bobaboard/ao3.js";

import { setFetcher } from "@bobaboard/ao3.js";
import Database from "better-sqlite3";

setFetcher(async (...params: Parameters<typeof fetch>) => {
  console.log(`Making a new request to ${params[0]}`);
  let response = await fetch(...params);
  console.log(`Response status: ${response.status}`);
  while (response.status == 429) {
    const waitSeconds = response.headers.get("retry-after");
    console.log(
      `Asked to wait ${waitSeconds} seconds to send request to ${params[0]}`
    );
    console.log(`Waiting ${waitSeconds} seconds`);
    if (!waitSeconds) {
      throw new Error("A wait request was made without indication of length.");
    }
    await new Promise((res) => {
      setTimeout(() => res(null), parseInt(waitSeconds) * 1000);
    });
    console.log(`Continuing with request to ${params[0]}`);
    response = await fetch(...params);
  }
  return response;
});

const db = new Database("ship-tags.db");
db.exec(`CREATE TABLE IF NOT EXISTS tags(
    name string,
    request_id string,
    ao3_id string,
    category string,
    canonical string,
    common string,
    canonical_name string);`);

const queryResult = db
  .prepare("select MAX(request_id) as lastId from tags;")
  .get();

// @ts-ignore
const startFrom = queryResult.lastId;
for (let i = startFrom + 1; i <= startFrom + 100; i++) {
  try {
    const tagName = await getTagNameById({ tagId: i.toString() });
    console.log(tagName);
    if (tagName) {
      const tag = await getTag({ tagName: tagName });
      console.log(tag);
      if (tag) {
        db.prepare(
          `INSERT INTO tags(
                name,
                request_id,
                ao3_id,
                category,
                canonical,
                common,
                canonical_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          tag.name,
          i,
          tag.id,
          tag.category,
          String(tag.canonical),
          String(tag.common),
          tag.canonicalName
        );
      }
    }
  } catch (e) {
    console.log(`Error happened! Skipping tag ${i}`);
    console.error(e);
  }
}
