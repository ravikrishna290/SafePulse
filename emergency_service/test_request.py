import requests
import json
import time

URL = "http://127.0.0.1:8000/analyze"

payload = {
  "message": "people are running and shouting",
  "crowd_density": 85,
  "movement": "high",
  "noise_level": 60,
  "prev_crowd": 75,
  "zone": "lobby"
}

print("========================================")
print(f"Sending Request to: {URL}")
print("Payload:")
print(json.dumps(payload, indent=2))
print("========================================\n")

try:
    start_time = time.time()
    response = requests.post(URL, json=payload)
    response.raise_for_status()
    
    end_time = time.time()
    round_trip_ms = int((end_time - start_time) * 1000)
    
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
    print(f"\n[Client] Total Round Trip Time: {round_trip_ms}ms")
    
except requests.exceptions.ConnectionError:
    print("Error: Could not connect to the server. Is FastAPI running?")
    print("Run `uvicorn main:app --reload` first.")
except Exception as e:
    print(f"Error: {e}")
