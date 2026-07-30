import json
import urllib.request
import urllib.error
import os

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
DATABASE_ID = "2e7e6edebc2881dda3d6000b98a22669"

print(f"Token prefix: {NOTION_TOKEN[:10]}...")
print(f"Database ID: {DATABASE_ID}")

def notion_request(url, payload=None):
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    method = "POST" if payload is not None else "GET"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP {e.code} error for {url}")
        print(f"Response: {body}")
        raise

# First test: list databases to verify token works
print("\nTesting token by calling /v1/users/me ...")
try:
    me = notion_request("https://api.notion.com/v1/users/me")
    print(f"Token valid. Bot: {me.get('name', 'unknown')}")
except Exception as e:
    print(f"Token test failed: {e}")

# Second test: query the database directly
print(f"\nQuerying database {DATABASE_ID} ...")
url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
payload = {"page_size": 3}

try:
    result = notion_request(url, payload)
    print(f"Success! Found {len(result.get('results', []))} results")
except Exception as e:
    print(f"Database query failed: {e}")
    
    # Try with dashes version
    db_with_dashes = "2e7e6ede-bc28-81dd-a3d6-000b98a22669"
    print(f"\nRetrying with dashes version: {db_with_dashes}")
    url2 = f"https://api.notion.com/v1/databases/{db_with_dashes}/query"
    try:
        result2 = notion_request(url2, payload)
        print(f"Success with dashes! Found {len(result2.get('results', []))} results")
    except Exception as e2:
        print(f"Also failed with dashes: {e2}")
