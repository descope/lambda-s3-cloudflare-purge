import { S3Event } from "aws-lambda";
import * as path from "node:path";

import { Cloudflare } from "cloudflare";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handler = async (event: S3Event) => {
  for (const envVar of [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ZONE_ID",
    "BASE_URL",
  ]) {
    if (!process.env[envVar]) throw new Error(`${envVar} is not set`);
  }

  const key = path.dirname(event.Records[0].s3.object.key);

  // Only purge if key contains "Peuc"
  if (!key.includes("Peuc")) {
    console.info({ message: 'Key does not contain "Peuc", skipping purge.', key });
    return;
  }

  const cloudflare = new Cloudflare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });

  const prefix = path.join(process.env.BASE_URL!, key);
  console.info({
    message: "Purging cache",
    key,
    baseUrl: process.env.BASE_URL,
    prefix,
  });

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await cloudflare.cache.purge({
        zone_id: process.env.CLOUDFLARE_ZONE_ID!,
        prefixes: [prefix],
      });
      
      console.debug({ success: true, message: res }, { depth: null });
      return; // Success, exit the function
    } catch (err: any) {
      lastError = err;
      console.debug({ 
        success: false, 
        message: err, 
        attempt, 
        maxRetries 
      }, { depth: null });
      
      if (attempt < maxRetries) {
        await delay(1000);
      }
    }
  }

  // All retries failed
  throw new Error(lastError);
};
