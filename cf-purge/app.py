import os
import json
import urllib3

http = urllib3.PoolManager()
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
