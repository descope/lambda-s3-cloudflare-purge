import { afterAll, beforeAll, describe, expect, test, jest } from "@jest/globals";
import * as path from "node:path";

import nock from "nock";
import { handler } from "../src/index";

import { afterEach, beforeEach } from "node:test";
import sampleEvent from "../events/event.json";

// Mock console methods to suppress output during tests
let infoSpy: any;
let debugSpy: any;

beforeAll(() => {
  nock.disableNetConnect();
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
});

beforeEach(() => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
  delete process.env.BASE_URL;
  delete process.env.CLOUDFLARE_ZONE_ID_2;
  delete process.env.BASE_URL_2;
});

describe("test handler", () => {
  test("ensures require env vars are set", async () => {
    await expect(handler(sampleEvent)).rejects.toThrow(
      "CLOUDFLARE_API_TOKEN is not set",
    );

    process.env.CLOUDFLARE_API_TOKEN = "test";
    await expect(handler(sampleEvent)).rejects.toThrow(
      "CLOUDFLARE_ZONE_ID is not set",
    );

    process.env.CLOUDFLARE_ZONE_ID = "test";
    await expect(handler(sampleEvent)).rejects.toThrow(
      "BASE_URL is not set",
    );

    process.env.BASE_URL = "test";
    nock("https://api.cloudflare.com")
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`)
      .reply(200, { success: true });
    await expect(handler(sampleEvent)).resolves.toBeUndefined();
  });

  test("ensures request is made to cloudflare", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "testToken";
    process.env.CLOUDFLARE_ZONE_ID = "testZone";
    process.env.BASE_URL = "example.com";

    nock("https://api.cloudflare.com", {
      reqheaders: {
        Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
      },
    })
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        prefixes: [
          `${path.join(process.env.BASE_URL!, path.dirname(sampleEvent.Records[0].s3.object.key))}`,
        ],
      })
      .reply(200, { success: true });

    await expect(handler(sampleEvent)).resolves.toBeUndefined();
  });

  test("error reporting", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "testToken";
    process.env.CLOUDFLARE_ZONE_ID = "testZone";
    process.env.BASE_URL = "example.com";

    nock("https://api.cloudflare.com")
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`)
      .reply(400, { success: false });

    await expect(handler(sampleEvent)).rejects.toThrow(
      'Failed to purge cache in 1 zone(s)',
    );
  });

  test("ensures dual zone purging works", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "testToken";
    process.env.CLOUDFLARE_ZONE_ID = "testZone1";
    process.env.BASE_URL = "example.com";
    process.env.CLOUDFLARE_ZONE_ID_2 = "testZone2";
    process.env.BASE_URL_2 = "example2.com";

    const expectedPrefix1 = path.join(process.env.BASE_URL, path.dirname(sampleEvent.Records[0].s3.object.key));
    const expectedPrefix2 = path.join(process.env.BASE_URL_2, path.dirname(sampleEvent.Records[0].s3.object.key));

    nock("https://api.cloudflare.com")
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        prefixes: [expectedPrefix1],
      })
      .reply(200, { success: true })
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID_2}/purge_cache`, {
        prefixes: [expectedPrefix2],
      })
      .reply(200, { success: true });

    await expect(handler(sampleEvent)).resolves.toBeUndefined();
  });

  test("handles partial failure in dual zone setup", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "testToken";
    process.env.CLOUDFLARE_ZONE_ID = "testZone1";
    process.env.BASE_URL = "example.com";
    process.env.CLOUDFLARE_ZONE_ID_2 = "testZone2";
    process.env.BASE_URL_2 = "example2.com";

    const expectedPrefix1 = path.join(process.env.BASE_URL, path.dirname(sampleEvent.Records[0].s3.object.key));
    const expectedPrefix2 = path.join(process.env.BASE_URL_2, path.dirname(sampleEvent.Records[0].s3.object.key));

    nock("https://api.cloudflare.com")
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        prefixes: [expectedPrefix1],
      })
      .reply(200, { success: true })
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID_2}/purge_cache`, {
        prefixes: [expectedPrefix2],
      })
      .reply(400, { success: false });

    await expect(handler(sampleEvent)).rejects.toThrow(
      'Failed to purge cache in 1 zone(s)',
    );
  });

  test("works with only second zone variables set", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "testToken";
    process.env.CLOUDFLARE_ZONE_ID = "testZone1";
    process.env.BASE_URL = "example.com";
    // Only CLOUDFLARE_ZONE_ID_2 set, not BASE_URL_2
    process.env.CLOUDFLARE_ZONE_ID_2 = "testZone2";
    // Explicitly ensure BASE_URL_2 is not set
    delete process.env.BASE_URL_2;

    nock("https://api.cloudflare.com")
      .post(`/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`)
      .reply(200, { success: true });

    await expect(handler(sampleEvent)).resolves.toBeUndefined();
  });
});

afterEach(() => {
  nock.cleanAll();
  expect(nock.pendingMocks()).toStrictEqual([]);
});

afterAll(() => {
  nock.enableNetConnect();
  infoSpy.mockRestore();
  debugSpy.mockRestore();
});
