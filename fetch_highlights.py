import json
import urllib.request
import urllib.error
import os

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
DATABASE_ID = "2e7e6ede-bc28-81dd-a3d6-000b98a22669"

def notion_request(url, payload=None):
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def get_book_title(page_url):
    """Fetch book title from a related page URL."""
    try:
        page_id = page_url.rstrip("/").split("/")[-1]
        result = notion_request(f"https://api.notion.com/v1/pages/{page_id}")
        props = result.get("properties", {})
        # Try common title property names
        for key in ["Name", "title", "Title", "书名"]:
            if key in props:
                title_parts = props[key].get("title", [])
                if title_parts:
                    return "".join(t.get("plain_text", "") for t in title_parts)
    except Exception:
        pass
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
            
            # Get highlight text
            name_parts = props.get("Name", {}).get("title", [])
            text = "".join(t.get("plain_text", "") for t in name_parts).strip()
            if not text:
                continue
            
            # Get book name
            book = ""
            book_relations = props.get("书籍", {}).get("relation", [])
            if book_relations:
                book_page_id = book_relations[0].get("id", "")
                if book_page_id:
                    if book_page_id not in book_cache:
                        book_cache[book_page_id] = get_book_title(
                            f"https://api.notion.com/v1/pages/{book_page_id}"
                        )
                    book = book_cache[book_page_id]
            
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
