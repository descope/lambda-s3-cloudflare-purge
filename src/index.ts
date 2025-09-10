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

  // Optional second zone support - both variables must be set
  const hasSecondZone = process.env.CLOUDFLARE_ZONE_ID_2 && process.env.BASE_URL_2;

  const key = path.dirname(event.Records[0].s3.object.key);

  // Only purge if key contains "Peuc"
  if (!key.includes("Peuc")) {
    console.info({ message: 'Key does not contain "Peuc", skipping purge.', key });
    return;
  }

  const cloudflare = new Cloudflare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });

  // Prepare zone configurations
  const zones = [
    {
      zoneId: process.env.CLOUDFLARE_ZONE_ID!,
      baseUrl: process.env.BASE_URL!,
      prefix: path.join(process.env.BASE_URL!, key),
    },
  ];

  if (hasSecondZone) {
    zones.push({
      zoneId: process.env.CLOUDFLARE_ZONE_ID_2!,
      baseUrl: process.env.BASE_URL_2!,
      prefix: path.join(process.env.BASE_URL_2!, key),
    });
  }

  console.info({
    message: "Purging cache",
    key,
    zones: zones.map(z => ({ zoneId: z.zoneId, baseUrl: z.baseUrl, prefix: z.prefix })),
  });

  const maxRetries = 3;
  const results: Array<{ zoneId: string; success: boolean; error?: any }> = [];

  // Purge cache in all zones
  for (const zone of zones) {
    let lastError: any;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await cloudflare.cache.purge({
          zone_id: zone.zoneId,
          prefixes: [zone.prefix],
        });
        
        console.debug({ 
          zoneId: zone.zoneId,
          success: true, 
          message: res 
        }, { depth: null });
        
        success = true;
        break; // Success, break retry loop
      } catch (err: any) {
        lastError = err;
        console.debug({ 
          zoneId: zone.zoneId,
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

    results.push({
      zoneId: zone.zoneId,
      success,
      error: success ? undefined : lastError,
    });
  }

  // Check if any zone failed
  const failedZones = results.filter(r => !r.success);
  if (failedZones.length > 0) {
    const errorMessage = `Failed to purge cache in ${failedZones.length} zone(s): ${failedZones.map(z => `${z.zoneId}: ${z.error}`).join(', ')}`;
    throw new Error(errorMessage);
  }
};
