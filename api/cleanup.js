import { sweep } from "../src/files.js";

/** Daily cron: deletes expired .hcmotion files so the store does not fill up. */
export default async function handler(req, res) {
 const secret = process.env.CRON_SECRET;
 if (!secret || req.headers?.authorization !== `Bearer ${secret}`) { res.statusCode = 401; return res.end("Unauthorized"); }
 const removed = await sweep();
 res.statusCode = 200;
 res.setHeader("Content-Type", "application/json");
 res.end(JSON.stringify({ removed }));
}
