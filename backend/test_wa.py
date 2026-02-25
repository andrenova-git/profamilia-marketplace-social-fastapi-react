import requests
import json
import sys

# User's provided config
URL = "http://152.67.33.214:8080"
INSTANCE = "admin_profamilia"
API_KEY = "casauniao_secret_key"

def test_send():
    endpoint = f"{URL}/message/sendText/{INSTANCE}"
    
    # We will test with a dummy number first just to see if it authenticates 
    # and accepts the payload format, or we can use the user's number if we knew it.
    # Let's use a standard dummy Brazilian mobile number.
    payload = {
        "number": "5511999999999",
        "text": "Teste de integração automática"
    }
    
    headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json"
    }
    
    print(f"Sending to {endpoint}...")
    try:
        response = requests.post(endpoint, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        print("Response:", response.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_send()
