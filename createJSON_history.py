import json

chat_data = {
  "chats": [
    {
      "id": "1",
      "title": "Nome chat JSON ",
      "messages": [
        {
          "id": 1,
          "sender": "user",
          "content": "Hello, I need help with Python.",
          "type": "text",
        },
        {
          "id": 2,
          "sender": "ai",
          "content": "I'd be happy to help! What specific question do you have?",
          "type": "text",
        }
      ],


      "model": "deepseek-r1:1.5b",
      "address": "localhost",
      "temperature": 0.6,
      "context_length": 50,
      "role": "carpentiere"


    }
  ]
}

with open("chat_history.json", "w", encoding="utf-8") as f:
    json.dump(chat_data, f) # indent=4) <- no indent: more efficient
