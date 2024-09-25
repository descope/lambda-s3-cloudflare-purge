import { S3Event } from "aws-lambda";
import * as path from "node:path";

import { Cloudflare } from "cloudflare";

export const handler = async (event: S3Event) => {
  for (const envVar of [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ZONE_ID",
    "BASE_URL",
  ]) {
    if (!process.env[envVar]) throw new Error(`${envVar} is not set`);
  }

  const cloudflare = new Cloudflare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });

  const key = event.Records[0].s3.object.key;

  console.info({
    message: "Purging cache",
    key,
    baseUrl: process.env.BASE_URL,
  });
  await cloudflare.cache
    .purge({
      zone_id: process.env.CLOUDFLARE_ZONE_ID!,
      prefixes: [`${process.env.BASE_URL}/${path.dirname(key)}`],
    })
    .then((res) =>
      console.debug({ success: true, message: res }, { depth: null }),
    )
    .catch((err) => {
      console.debug({ success: false, message: err }, { depth: null });
      throw new Error(err);
    });
};
