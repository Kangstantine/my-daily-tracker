import json
import urllib.request
import urllib.error
import os

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
DATABASE_ID = "2e7e6edebc2881dda3d6000b98a22669"

def notion_request(url, payload=None):
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    method = "POST" if payload is not None else "GET"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_book_title(page_id):
    try:
        result = notion_request(f"https://api.notion.com/v1/pages/{page_id}")
        props = result.get("properties", {})
        for key in ["Name", "title", "Title", "书名"]:
            if key in props:
                parts = props[key].get("title", [])
                if parts:
                    return "".join(t.get("plain_text", "") for t in parts)
    except Exception as e:
        print(f"  Could not fetch book title: {e}")
    return ""

def fetch_highlights():
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "page_size": 200,
        "sorts": [{"property": "Date", "direction": "descending"}],
        "filter": {
            "property": "Name",
            "title": {"is_not_empty": True}
        }
    }

    highlights = []
    book_cache = {}

    while True:
        result = notion_request(url, payload)

        for page in result.get("results", []):
            props = page.get("properties", {})

            name_parts = props.get("Name", {}).get("title", [])
            text = "".join(t.get("plain_text", "") for t in name_parts).strip()
            if not text:
                continue

            book = ""
            book_relations = props.get("书籍", {}).get("relation", [])
            if book_relations:
                book_id = book_relations[0].get("id", "").replace("-", "")
                if book_id:
                    if book_id not in book_cache:
                        book_cache[book_id] = get_book_title(book_id)
                    book = book_cache[book_id]

            highlights.append({"text": text, "book": book})

        if not result.get("has_more"):
            break
        payload["start_cursor"] = result.get("next_cursor")

    return highlights

if __name__ == "__main__":
    print("Fetching highlights from Notion...")
    highlights = fetch_highlights()
    print(f"Found {len(highlights)} highlights")

    os.makedirs("data", exist_ok=True)
    with open("data/highlights.json", "w", encoding="utf-8") as f:
        json.dump(highlights, f, ensure_ascii=False, indent=2)

    print("Saved to data/highlights.json")
