import os
import CloudFlare

cf = CloudFlare.CloudFlare()
zone = os.environ.get("CLOUDFLARE_ZONE")
base_url = os.environ.get("BASE_URL")

def lambda_handler(event, context):
    print("## EVENT: ", event)
    for record in event['Records']:
        purge(record["s3"]["object"]["key"])


def purge(key):
    file = base_url + key
    print("## Purging ", file)
    print(cf.zones.purge_cache.post(zone, data={'files': [file]}))