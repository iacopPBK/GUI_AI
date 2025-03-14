from flask import Flask, render_template
from flask_socketio import SocketIO, send, emit
from OllamaComm3 import OllamaPOST
import json
import os
import threading

##### INI JSON #####
with open("ini_data.json", "r", encoding="utf-8") as f:
    INI = json.load(f)

#### COSTANTS
OLLAMA_URL = INI["OLLAMA_URL"]
DEFAULT_MODEL =  INI["DEFAULT_MODEL"]
ROLES = INI["ROLES"]

#template = os.path.join(os.getcwd(), "templates2") # needs import os
app = Flask(__name__) # app = Flask(__name__)
app.config['SECRET_KEY'] = 'sdifjansovkjdsnfvasnxlvmnskdjknvsv'
socketio = SocketIO(app)

# Store chat messages
chat_messages = []
# Store active generations
active_generations = {}

# Initialize the Ollama communication instances
Ollama = OllamaPOST()

@app.route('/')
def index():
    return render_template('index.html')

#### MANAGE MESSAGES
@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a message and getting the model's response."""
    user_message = data['message']
    Ollama.data['model'] = data.get('model', DEFAULT_MODEL)
    Ollama.address = data.get('address', OLLAMA_URL)
    chat_id = data.get('chatId', 1)  # Default to 1 if not provided

    chat_messages.append({"sender": "user", "message": user_message})
    send({"sender": "user", "message": user_message}, broadcast=True)

    if not Ollama.data["stream"]:
        try:
            # Get the model's response using Ollama
            model_response = Ollama.talk_to_ollama(user_message)
            # Store the model's response in the chat history
            chat_messages.append({"sender": "ai", "message": model_response})
            # Broadcast the model's response to all clients
            send({"sender": "ai", "message": model_response}, broadcast=True)
        except Exception as e:
            # Send error message if response fails
            error_msg = f"Error getting response from {Ollama.data['model']}: {str(e)}"
            send({"sender": "system", "message": error_msg}, broadcast=True)

    else:
        try:
            # Create a stop event for this generation
            stop_event = threading.Event()
            # Store the stop event for this chat
            active_generations[chat_id] = stop_event

            # Get the model's response using Ollama with streaming
            send({"sender": "ai", "message": "", "isStreaming": True, "chatId": data['chatId']}, broadcast=True)
            
            def stream_callback(partial_response):
                send({"sender": "ai", "message": partial_response, "isStreaming": True, "chatId": data['chatId']}, broadcast=True)
                if socketio and chat_id:
                    socketio.emit('token_stats', {
                        'total_tokens': Ollama.token_count,
                        'tokens_per_second': Ollama.tokens_per_second,
                        'generation_time': Ollama.elapsed_time,
                        'chatId': chat_id
                    })
                if stop_event.is_set():
                    return False  # Returning False will signal to stop the generation
            
            model_response = Ollama.talk_to_ollama(user_message, stream_callback=stream_callback)
            # Send token stats to client if socketio is available
            if socketio and chat_id:
                    socketio.emit('token_stats', {
                        'total_tokens': Ollama.token_count,
                        'tokens_per_second': Ollama.tokens_per_second,
                        'generation_time': Ollama.elapsed_time,
                        'chatId': chat_id
                    })


            # Store the model's response in the chat history
            chat_messages.append({"sender": "ai", "message": model_response})
            
            # First send the complete response
            # This can be commented out if you don't need the complete response at the end
            # send({"sender": "ai", "message": model_response, "isStreaming": False, "chatId": data['chatId']}, broadcast=True)
            
            # Then send an empty message with isEndOfStream: true to signal the end
            send({"sender": "ai", "message": "", "isEndOfStream": True, "chatId": data['chatId']}, broadcast=True)
            
            # Clean up
            if chat_id in active_generations:
                del active_generations[chat_id]
                
        except Exception as e:
            # Send error message if response fails
            error_msg = f"Error getting response from {Ollama.data['model']}: {str(e)}"
            send({"sender": "system", "message": error_msg}, broadcast=True)
            
            # Make sure to send end-of-stream even on error
            send({"sender": "ai", "message": "", "isEndOfStream": True, "chatId": data['chatId']}, broadcast=True)
            
            # Clean up
            if chat_id in active_generations:
                del active_generations[chat_id]

#### HANDLE STOP GENERATION
@socketio.on('generation-stopped')
def handle_stop_generation(data):
    """Handle stopping an ongoing generation."""
    chat_id = data.get('chatId', 1)  # Default to 1 if not provided
    
    try:
        # If we have an active generation for this chat
        if chat_id in active_generations:
            # Set the stop event to signal the stream callback to stop
            active_generations[chat_id].set()
            
            # Send a message indicating generation was stopped
            send({"sender": "system", "message": "Generation stopped by user.", "chatId": chat_id}, broadcast=True)
            
            # Do NOT delete active_generations[chat_id] here - let the stream callback handle cleanup
            # after it has properly sent the end-of-stream signal
            return True
        else:
            # No active generation to stop
            send({"sender": "system", "message": "No active generation to stop.", "chatId": chat_id}, broadcast=True)
            return False
            
    except Exception as e:
        # Send error message
        error_msg = f"Error stopping generation: {str(e)}"
        send({"sender": "system", "message": error_msg, "chatId": chat_id}, broadcast=True)
        return False

########### SETTINGS: ############
###########           ############

#### GET_AVAILABLE_MODELS
@socketio.on('get_available_models')
# Send available models to the client when requested
def handle_get_models(data=None): 
    # If data is provided, use the address from data, otherwise use default
    Ollama.address = data.get('address', OLLAMA_URL) if data else OLLAMA_URL
    
    try:
        # Get models from the specified address
        models = Ollama.get_ollama_models()
        emit('available_models', {
            'models': models,
            'default_model': DEFAULT_MODEL
        })
        
    except Exception as e:
        # Send error message if models can't be fetched
        error_msg = f"Failed to connect to Ollama at {Ollama.address}: {str(e)}"
        send({"sender": "system", "message": error_msg}, broadcast=True)
        # Still emit available_models but with empty list to avoid client errors
        emit('available_models', {
            'models': [],
            'default_model': DEFAULT_MODEL
        })

#### GET_AVAILABLE_MODELS FROM ADDRESS
@socketio.on('change_address')
def handle_change_address(data):
    """Handle changing the Ollama server address"""
    Ollama.address = data.get('address', OLLAMA_URL)
    
    try:
        # Get models from the new address
        models = Ollama.get_ollama_models()
        
        # Check if models list is empty
        if not models:
            raise Exception("No models found at the specified address")
            
        # If we have models, emit them
        emit('available_models', {
            'models': models,
            'default_model': DEFAULT_MODEL
        })
        
        # Send success message
        success_msg = f"Successfully connected to Ollama at {Ollama.address}"
        send({"sender": "system", "message": success_msg}, broadcast=True)
    except Exception as e:
        # Send error message
        error_msg = f"Failed to connect to Ollama at {Ollama.address}: {str(e)}"
        send({"sender": "system", "message": error_msg}, broadcast=True)

@socketio.on('change_model')
def handle_change_model(data):
    """Handle changing the model"""
    Ollama.data['model'] = data.get('model', DEFAULT_MODEL)
    Ollama.address = data.get('address', OLLAMA_URL)
    
#### GET_ROLES
@socketio.on('get_roles')
def send_roles():
    try:
        socketio.emit('available_roles', {'roles': ROLES})
    except Exception as e:
        send(f"Error sending roles: {e}", broadcast=True)

@socketio.on('set_role')
def receive_role(data):  
    try:
        selected_role = data.get('selected_role')
        # Emit available roles (if needed by the client)
        socketio.emit('available_roles', {'roles': ROLES})
        if selected_role in ROLES:
            Ollama.role_index = ROLES.index(selected_role)
            # Store all attributes for the selected role
            Ollama.role_flag = 1
            # print("role_idx: " + str(role_index))
            send({"sender": "system", "message": f"Role set to: {selected_role}"}, broadcast=True)
        else:
            send({"sender": "system", "message": "Invalid role selected."}, broadcast=True)
    except Exception as e:
        send({"sender": "system", "message": f"Error processing role selection: {str(e)}"}, broadcast=True)

#### MANAGE CONTEXT
@socketio.on('change_context')
def handle_change_context(data):
    try:
        Ollama.max_context_length = int(data.get('context_lenght', 50))
        # Send success message
        success_msg = f"Context length set to {Ollama.max_context_length}"
        send({"sender": "system", "message": success_msg}, broadcast=True)
    except Exception as e:
        # Send error message
        error_msg = f"Context length set to {Ollama.max_context_length}: {str(e)}"
        send({"sender": "system", "message": error_msg}, broadcast=True)

#### MANAGE TEMPERATURE
@socketio.on('change_temp')
def handle_change_temp(data):
    try:
        Ollama.data["temperature"]  = float(data.get('temp', 0.5))
        # Send success message
        success_msg = f"temperature length set to {Ollama.data["temperature"]}"
        send({"sender": "system", "message": success_msg}, broadcast=True)
    except Exception as e:
        # Send error message
        error_msg = f"temperature length set to {Ollama.data["temperature"]}: {str(e)}"
        send({"sender": "system", "message": error_msg}, broadcast=True)



#### MANAGE CONTEXT
@socketio.on('clear-context')
def clearing_context(data):
    if Ollama.role:
        Ollama.context = Ollama.role
    else:
        Ollama.context = []
















# Path for saving chat history
CHAT_HISTORY_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chat_history.json')

@socketio.on('save_chat')
def handle_save_chat(data):
    """Handle saving chat data to a JSON file"""
    print(f"Received pacchettone: {data}")

    try:        
        # Get the current chat ID
        current_chat_id = data['chatData']['id']
        # Get messages from the data or use an empty list
        messages = []
        raw_messages = data['chatData']['messages']
        
        # Convert messages to the expected format
        for i, msg in enumerate(raw_messages):
            # Check if the message is already in the right format
            if isinstance(msg, dict) and 'sender' in msg and 'message' in msg:
                messages.append({
                    "id": i + 1,
                    "sender": msg['sender'],
                    "content": msg['message'],
                    "type": "text"
                })
        
        # Create chat data structure
        chat_data = {
            "id": current_chat_id,
            "title": data['chatData']['title'],
            "messages": messages, 
            "model": data['chatData']['settings']['model'],
            "address":  data['chatData']['settings']['address'],
            "temperature": data['chatData']['settings']['temperature'],
            "context":  data['chatData']['settings']['context'],
            "role":  data['chatData']['settings']['role'],
        }
        
        # Ensure the directory exists
        file_path = data['filePath']
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Load existing chat history or create new
        existing_chat_data = {"chats": []}
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_chat_data = json.load(f)
            except Exception as e:
                print(f"Error reading chat history: {str(e)}")
        
        # Check if the chats key exists
        if 'chats' not in existing_chat_data:
            existing_chat_data['chats'] = []
        
        # Check if chat with same ID exists
        found = False
        for i, chat in enumerate(existing_chat_data['chats']):
            if chat.get('id') == current_chat_id:
                # Update existing chat
                existing_chat_data['chats'][i] = chat_data
                found = True
                break
        
        # If not found, add as new chat
        if not found:
            existing_chat_data['chats'].append(chat_data)
        
        # Write to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(existing_chat_data, f)
        
        # Send success response
        socketio.emit('chat_saved', {
            'success': True,
            'filePath': file_path,
        })
        
        print(f"Chat saved successfully: ID {current_chat_id} to {file_path}")
    
    except Exception as e:
        import traceback
        print(f"Error saving chat: {str(e)}")
        print(traceback.format_exc())
        socketio.emit('chat_saved', {
            'success': False,
            'error': str(e)
        })

@socketio.on('get_saved_chats')
def handle_get_saved_chats(data):
    """Handle retrieving saved chats"""
    try:
        # If data is a string, try to parse it
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except:
                # Use empty dict if parsing fails
                data = {}
        elif data is None:
            data = {}
            
        file_path = data.get('filePath', CHAT_HISTORY_PATH)
        
        # Check if the file exists
        if not os.path.exists(file_path):
            socketio.emit('saved_chats_list', {
                'success': True,
                'chats': []  # Empty array if no file exists yet
            })
            return
        
        # Read and parse the file
        with open(file_path, 'r', encoding='utf-8') as f:
            chat_data = json.load(f)
        
        # Get chats array from the structure
        chats = chat_data.get('chats', [])
        
        # Send the list of saved chats to the client
        socketio.emit('saved_chats_list', {
            'success': True,
            'chats': chats
        })
        print(f"STEP1saved chats: {str(chats)}")

    except Exception as e:
        import traceback
        print(f"Error loading saved chats: {str(e)}")
        print(traceback.format_exc())
        socketio.emit('saved_chats_list', {
            'success': False,
            'error': str(e)
        })


@socketio.on('load_chat')
def handle_load_chat(data):
    """Handle loading a specific chat by ID"""
    print(f"Loading data is: {data}")

    try:
        # If data is a string, try to parse it
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except:
                # Use empty dict if parsing fails
                data = {}
        elif data is None:
            data = {}
        
        # print(f"Loading data is: {data}")

        chat_id = data.get('chatId')
        # print(f"Chatid is: {chat_id}")
        if chat_id is None:
            raise ValueError("No chat ID provided")
            
        file_path = data.get('filePath', CHAT_HISTORY_PATH)
        
        # Check if the file exists
        if not os.path.exists(file_path):
            socketio.emit('chat_loaded', {
                'success': False,
                'error': f"Chat history file not found: {file_path}"
            })
            return
        
        # Read and parse the file
        with open(file_path, 'r', encoding='utf-8') as f:
            chat_data = json.load(f)
        print(f"Loading data is: {chat_data}")
        # Get chats array from the structure
        chats = chat_data.get('chats', [])
        # print(f"Chats are: {chats}")

        # Find the requested chat by ID
        found_chat = None
        for chat in chats:
            if chat.get('id') == chat_id:
                found_chat = chat
                break
                
        if found_chat is None:
            socketio.emit('chat_loaded', {
                'success': False,
                'error': f"Chat with ID {chat_id} not found"
            })
            return
        
        print(f"found_chat is: {found_chat}")
        
        # Send the chat data to the client
        socketio.emit('chat_loaded', {
            "success": True,
            "chatData": found_chat
        })
        

    except Exception as e:
        import traceback
        print(f"Error loading chat: {str(e)}")
        print(traceback.format_exc())
        socketio.emit('chat_loaded', {
            'success': False,
            'error': str(e)
        })











if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

