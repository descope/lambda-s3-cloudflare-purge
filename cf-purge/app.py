import os
import json
import urllib3

retries = urllib3.Retry(
    total=3,
    backoff_factor=2,
    connect=3,
    status=3,
    status_forcelist=[404, 405, 413, 429, 501, 502, 503, 504],
    method_whitelist=['POST'])
http = urllib3.PoolManager(retries=retries)
zone = os.environ.get("CLOUDFLARE_ZONE")
api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
base_url = os.environ.get("BASE_URL")


def lambda_handler(event, context):
    print("## EVENT: ", event)
    for record in event["Records"]:
        purge(record["s3"]["object"]["key"])


def purge(key):
    file = base_url + key
    print("## Purging ", file)
    r = http.request(
        "POST",
        f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_token}",
        },
        body=json.dumps({"files": [file]}),
        timeout=1.0,
    )
    print(r.status, r.data, key)
