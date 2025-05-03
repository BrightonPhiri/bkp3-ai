import http.client
import json
import os
import time
from contextlib import closing

def display_banner():
    print("\n" + "=" * 60)
    print("🚀 Zero2Launch AI Assistant 🚀".center(60))
    print("=" * 60 + "\n")

def display_thinking_animation(duration=1.5):
    """Display a simple animation while waiting for response"""
    thinking_chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    start_time = time.time()
    i = 0
    print("Thinking", end="", flush=True)
    while time.time() - start_time < duration:
        print(f"\rThinking {thinking_chars[i % len(thinking_chars)]}", end="", flush=True)
        time.sleep(0.1)
        i += 1
    print("\r" + " " * 20 + "\r", end="", flush=True)

def format_response(response_text):
    """Format the AI response for better readability"""
    print("\n" + "-" * 60)
    print("🤖 AI Response:")
    print("-" * 60)
    print(response_text)
    print("-" * 60 + "\n")

def generate_response(prompt):
    """Send request to Zero2Launch API and return the response"""
    # Get API key from environment variable or use default
    api_key = os.environ.get("ZERO2LAUNCH_API_KEY", "d860911ad19af07b8e7585a949df76edd0cf80afc86f93077a6697535ad472eb")
    
    # Create payload as Python dictionary for better readability
    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "model": "openai"
    }
    
    headers = {
        'X-API-Key': api_key,
        'Content-Type': "application/json"
    }
    
    print("📡 Sending request to AI...", flush=True)
    
    # Use context manager to ensure connection is properly closed
    with closing(http.client.HTTPSConnection("api.zero2launch.com")) as conn:
        try:
            conn.request("POST", "/generate-text", json.dumps(payload), headers)
            display_thinking_animation(1.5)
            
            print("📥 Receiving response...", flush=True)
            response = conn.getresponse()
            data = response.read()
            
            if response.status == 200:
                response_text = data.decode("utf-8")
                # Try to parse as JSON
                try:
                    return json.loads(response_text)
                except json.JSONDecodeError:
                    # If not JSON, return as plain text
                    return {"text": response_text}
            else:
                print(f"❌ Error: {response.status} {response.reason}")
                return {"error": data.decode("utf-8")}
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return {"error": str(e)}

def main():
    display_banner()
    print("Type 'exit' or 'quit' to end the session.\n")
    
    while True:
        user_prompt = input("💬 Enter your prompt: ")
        if user_prompt.lower() in ["exit", "quit"]:
            print("\nThank you for using Zero2Launch AI Assistant! Goodbye! 👋\n")
            break
        
        if not user_prompt.strip():
            print("Please enter a valid prompt.")
            continue
        
        response_data = generate_response(user_prompt)
        
        if "error" in response_data:
            print(f"❌ Error: {response_data['error']}")
        else:
            # Debug: Print the raw response to see its structure
            # print("\nDebug - Raw API Response:")
            # print(response_data)
            print()
            
            # Try different possible response structures
            try:
                # Try standard OpenAI format first
                if "choices" in response_data:
                    response_text = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                # Try alternative format with direct text
                elif "text" in response_data:
                    response_text = response_data["text"]
                # If response is plain text
                elif isinstance(response_data, str):
                    response_text = response_data
                # Other common API response formats
                elif "response" in response_data:
                    response_text = response_data["response"]
                elif "content" in response_data:
                    response_text = response_data["content"]
                else:
                    response_text = str(response_data)
                
                if response_text.strip():
                    format_response(response_text)
                else:
                    print("❌ No valid response text found in the API response.")
            except Exception as e:
                print(f"❌ Error parsing response: {e}")

if __name__ == "__main__":
    main()