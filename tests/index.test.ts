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
});

describe("test handler", () => {
  test("ensures require env vars are set", async () => {
    await expect(handler(sampleEvent)).rejects.toThrowError(
      "CLOUDFLARE_API_TOKEN is not set",
    );

    process.env.CLOUDFLARE_API_TOKEN = "test";
    await expect(handler(sampleEvent)).rejects.toThrowError(
      "CLOUDFLARE_ZONE_ID is not set",
    );

    process.env.CLOUDFLARE_ZONE_ID = "test";
    await expect(handler(sampleEvent)).rejects.toThrowError(
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

    await expect(handler(sampleEvent)).rejects.toThrowError(
      'Connection error',
    );
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
