import { S3Event } from "aws-lambda";

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

  console.dir({ message: "Purging cache", key, baseUrl: process.env.BASE_URL });
  await cloudflare.cache
    .purge({
      zone_id: process.env.CLOUDFLARE_ZONE_ID!,
      files: [`${process.env.BASE_URL}/${key}`],
    })
    .then((res) =>
      console.dir({ success: true, message: res }, { depth: null }),
    )
    .catch((err) => {
      console.dir({ success: false, message: err }, { depth: null });
      throw new Error(err);
    });
};
