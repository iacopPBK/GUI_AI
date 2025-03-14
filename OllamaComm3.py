# -*- coding: utf-8 -*-
"""
@author: meoai and iacop
"""
import requests 
import re
import json
from OllamaConnecta import OConnect
# import os
import time

##### INI JSON #####
with open("ini_data.json", "r", encoding="utf-8") as f:
    INI = json.load(f)

class OllamaPOST:
    # initialize OllamaPOST PROPERTIES    
    def __init__(self, OLLAMA_URL = INI["OLLAMA_URL"], PROVIDER = INI["DEFAULT_PROVIDER"], OLLAMA_DATA = INI["OLLAMA_DATA"], MAX_CONTEXT_LEN = INI["MAX_CONTEXT_LEN"], ROLES_ATTRIBUTE = INI["ROLES_ATTRIBUTE"]):
        # System 
        self.session = requests.Session()  # Persistent session for efficiency
        self.address = OLLAMA_URL      
        self.data = OLLAMA_DATA

        # Constants
        self.max_context_length = MAX_CONTEXT_LEN   # max length of context buffer
        self.role_buffer = len(ROLES_ATTRIBUTE[5])     # length role buffer
       
       # Flags
        self.role_flag = 0      # true: trascription of roles on, false: end of trascription roles, user input now

        # Variables
        self.context = []  
        self.answer = ""        # model answer
        self.role_index = 0     # index of the role in the list
        self.role = []          # save roles description
        
        # Other Classes Objects:
        self.web_search = OConnect(self.session, PROVIDER)

        # Performance Classes Objects:
        self.token_count = 0
        self.elapsed_time = 0
        self.tokens_per_second = 0

##### TALK TO OLLAMA #####
    # manages ollama communication
    def talk_to_ollama(self, user_input, stream_callback=None):          
        start_time = time.time()
        self.token_count = 0
        
        # changes input format based on role on/off and what role:
        tmp_input = self.manage_context(user_input=user_input)
        # changes input format based on role on/off and what role:
        new_userinput = self.web_search.talk_to_web(user_input=user_input, tmp_input=tmp_input, context=self.context)   
        streaming_active = self.data["stream"] # check activate streaming

        self.data["prompt"] = new_userinput    # assign prompt message in JSON
        if not streaming_active:
            try:
                # Make the POST request
                response = self.session.post(self.address+"/api/generate", headers=INI["HEADERS"], json=self.data) # timeout=10)
                response.raise_for_status()
                response_data = response.json()
                model_output = response_data.get('response', 'No response received.')
                cleaned_output_tmp = self.clean_response(model_output)
                self.manage_context(user_input=user_input, assist_input=cleaned_output_tmp)
                cleaned_output = self.answer
                
                # Simple token count estimation (approximate)
                self.token_count = len(model_output.split())
                self.elapsed_time = time.time() - start_time
                self.tokens_per_second = self.token_count / self.elapsed_time if self.elapsed_time > 0 else 0
                                
                return cleaned_output       
            except requests.exceptions.RequestException as e:
                return f"API Error: {e}"
        else:
            try:
                
                # Make the POST request with streaming enabled
                complete_response = ""
                response = self.session.post(self.address + "/api/generate", headers=INI["HEADERS"], json=self.data, stream=True)
                response.raise_for_status()

                # Initialize token counting and timing variables
                start_time = time.time()
                self.token_count = 0
                last_update_time = start_time
                update_interval = 0.5  # Update stats every 0.5 seconds

                
                for line in response.iter_lines():
                    if line:
                        try:
                            # Parse the JSON object from each line
                            decoded_line = line.decode('utf-8')
                            json_data = json.loads(decoded_line)                               
                            
                            # Extract just the response field
                            if 'response' in json_data:
                                response_chunk = json_data['response']
                                complete_response += response_chunk
                                
                                # Approximate token count for this chunk (word count is a rough estimate)
                                chunk_tokens = len(response_chunk.split())
                                self.token_count += chunk_tokens
                                
                                # Calculate and send token stats periodically
                                current_time = time.time()
                                if current_time - last_update_time >= update_interval:
                                    self.elapsed_time = current_time - start_time
                                    self.tokens_per_second = self.token_count / self.elapsed_time if self.elapsed_time > 0 else 0
                                    
                                    
                                    # Terminal output
                                    print(f"\rTokens: {self.token_count} | Speed: {self.tokens_per_second:.2f} t/s", end="")
                                    last_update_time = current_time
                                
                                # Call the callback with just the cleaned response text
                                if stream_callback:
                                    callback_result = stream_callback(response_chunk)
                                    if callback_result is False:
                                        # Close the connection if callback returns False
                                        response.close()
                                        break
                                        
                        except json.JSONDecodeError:
                                # Skip lines that aren't valid JSON
                            continue    
                
                # After all chunks are processed, calculate final stats
                self.elapsed_time = time.time() - start_time
                self.tokens_per_second = self.token_count / self.elapsed_time if self.elapsed_time > 0 else 0
                
                
                # Display final statistics in terminal
                print("\n----------- Generation Complete -----------")
                print(f"Total tokens: {self.token_count}")
                print(f"Total time: {self.elapsed_time:.2f} seconds")
                print(f"Average speed: {self.tokens_per_second:.2f} tokens/sec")
                print("-------------------------------------------")
                
                # Update the context with the complete response
                final_response = self.clean_response(complete_response)
                self.manage_context(user_input=user_input, assist_input=final_response)
                self.answer = final_response
                
                return final_response
            except requests.exceptions.RequestException as e:
                return f"API Error: {e}"

##### MODELS ##### 
    def get_ollama_models(self):
        try:
            response = self.session.get(self.address+"/api/tags")
            models_data = response.json()
            # Extract model names from the response
            models = [model['name'] for model in models_data['models']]
            return models
        except requests.exceptions.RequestException as e:
            return []

##### ROLES #####
    # assistant context manager (called in manage_context())
    def assistant_manager(self, assist_input):
        clean_input = assist_input.replace("\n","")
        if self.role_index == 0:
            self.context.append(clean_input)
        else:
            self.context.append("ASSISTANT: " + clean_input)
        self.answer = assist_input
       
    # role manager for context (called in manage_context())
    def role_manager(self, user_input):
        # CASE 1: if role = "one of the selection" (but not "None" nor "User Defined")
        if self.role_index >1:                       
            if self.role_flag == 0:         # if the role description-mode is still active
                self.context.append("USER: " + user_input) 
            else:
                for role in INI["ROLES_ATTRIBUTE"][self.role_index]:
                    if role:           
                        self.context.append("SYSTEM: " + role)
                        self.role.append("SYSTEM: " + role)
                    else: break
                self.role_flag = 0

        # CASE 2: if role == "User Defined"
        elif self.role_index == 1:                                      
            tmp = ["system","user"]     
            size = len(user_input)
            N = len(tmp[0]) + 1                   # can be more clean
            N2 = len(tmp[1]) + 1
            if size<= N-1: 
                N = 1
                N2 = 1
                tmp = ["sy","us"] 

            if tmp[0] in user_input[:N].lower():
                new_input = user_input[N:]
                self.context.append("SYSTEM: " + new_input)
                self.role.append("SYSTEM: " + new_input)
            elif tmp[1] in user_input[:N2].lower():
                new_input = user_input[N2:]
                self.context.append("USER: " + new_input )
            else: self.context.append("USER: " + user_input) 
                

        # CASE 3: if role == "None"
        else:                               
            self.context.append(user_input) 
                
    # function to manage the context length and the roles assignation with "USER, SYSTEM, ASSISTANT"
    def manage_context(self, user_input=None, assist_input=None):
        ## CONTEXT ON ##
        if self.max_context_length != 0: 
            # if assistant is talking
            if assist_input:    
                self.assistant_manager(assist_input)
            # if user or sys are talking
            elif user_input:      
                self.role_manager(user_input)
            # manages the buffer for the context
            if len(self.context) > self.max_context_length:
                self.context = self.context[-self.max_context_length:]
                self.context[-self.role_buffer:] = self.role[:self.role_buffer]
                # print("End BUffer reached")            
        ## CONTEXT OFF ## -> just returns itself
        else:
            self.context = [user_input]  
        return "\n".join(self.context)  # string format for model prompt

##### DEBUG & SETTINGS #####
    # check my class objects by prining them
    def checkObj(self):
        print(self.__dict__)

    # Rimuove il contenuto tra i tag <think> e </think> dalla risposta.
    def clean_response(self, response): 
        # Usa una regex per trovare e rimuovere tutto ciò che è tra <think> e </think>
        # cleaned_response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
        return response  # Rimuove spazi bianchi extra

        