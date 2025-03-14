import json


#      OLLAMA_DEBUG               Show additional debug information (e.g. OLLAMA_DEBUG=1)
#      OLLAMA_HOST                IP Address for the ollama server (default 127.0.0.1:11434)
#      OLLAMA_KEEP_ALIVE          The duration that models stay loaded in memory (default "5m")
#      OLLAMA_MAX_LOADED_MODELS   Maximum number of loaded models per GPU
#      OLLAMA_MAX_QUEUE           Maximum number of queued requests
#      OLLAMA_MODELS              The path to the models directory
#      OLLAMA_NUM_PARALLEL        Maximum number of parallel requests
#      OLLAMA_NOPRUNE             Do not prune model blobs on startup
#      OLLAMA_ORIGINS             A comma separated list of allowed origins
#      OLLAMA_SCHED_SPREAD        Always schedule model across all GPUs

#      OLLAMA_FLASH_ATTENTION     Enabled flash attention
#      OLLAMA_KV_CACHE_TYPE       Quantization type for the K/V cache (default: f16)
#      OLLAMA_LLM_LIBRARY         Set LLM library to bypass autodetection
#      OLLAMA_GPU_OVERHEAD        Reserve a portion of VRAM per GPU (bytes)
#      OLLAMA_LOAD_TIMEOUT        How long to allow model loads to stall before giving up (default "5m")



HEADERS = {"Content-Type": "application/json"}
MAX_CONTEXT_LEN = 50
DEFAULT_PROVIDER = "duckduckgo" 
OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "deepseek-coder:6.7b"  # Default model to use

PROVIDERS = ["duckduckgo", "bing", "google"]
ROLES_ATTRIBUTE = [
    ["","",""],
    ["","",""],
    ["You are an helpful assistant and you'll answer my questions.","",""],
    ["You are a precise scientist and engineer.", "You always double check your soruces and you quote them.","You base your research on scientific papers and highly reliable data."],
    ["You are a software engineer and you'll help me with my code.", "You're expert in python specialized in ML and DL.",""], 
    ["You are a software engineer and you'll help me with my code.", "Always comment your code and structure it well.",""],
    ["You are a gourmet chef, you'll help me with recipes and explain step by step.", "",""],
    ["You are a story teller.","",""]
    ]

OLLAMA_DATA = {
        "model":  "deepseek-coder:6.7b", #Specifica il modello LLM che desideri utilizzare
        "prompt": "Prova" ,         #Il testo di input o la domanda che desideri inviare al LLM
        "temperature": 0.6,         #Controlla la casualit� dell'output. Valori pi� alti (es. 1.0) rendono l'output pi� casuale e creativo, mentre valori pi� bassi (es. 0.2) lo rendono pi� deterministico e focalizzato
        "max_tokens": 500,         #Specifica il numero massimo di token (parole o parti di parole) nella risposta generata
        "top_p": 0.9,               #Come compilarlo: Scegli un valore compreso tra 0.0 e 1.0. Un valore di 1.0 considera tutti i token, mentre valori pi� bassi considerano solo i token con probabilit� pi� alta
        "frequency_penalty": 0.0,   #Come compilarlo: Scegli un valore compreso tra -2.0 e 2.0. Valori positivi riducono la ripetizione
        "presence_penalty": 0.0,    #Come compilarlo: Scegli un valore compreso tra -2.0 e 2.0. Valori positivi incoraggiano la diversit�
        "stop": ["\n\n", "###"],    #Come compilarlo: Inserisci un array di stringhe che rappresentano le sequenze di stop. Ad esempio, ["\n\n", "###"] potrebbe indicare che il modello dovrebbe smettere di generare output quando incontra due newline o la sequenza "###"
        "stream": True,              #come compilarlo: imposta a true se vuoi ricevere la risposta in parti, oppure a false se vuoi riceverla tutta in una volta
        "options":{
            "batch": 256,
            "num_ctx": 4096
            }
    }
TRIGGER_KEYWORDS = [
    "latest", "current", "breaking", "today", "now", "live", "recent", "trending",
    "update", "updates", "news", "happening", "just in", "in progress", "real-time",
    "live update", "live news", "flash", "alert", "emergency", "today's", "this morning",
    "this afternoon", "this evening", "up-to-date", "live coverage", "currently",
    "ongoing", "developing", "newly", "instant", "immediate", "as it happens", "tomorrow", 
    "internet", "web", "online"
]
ROLES =["None",
        "User Defined",
        "Basic Assistant",
        "Precise Scientist & Engineer", 
        "Python Expert (ML,DL,Opt)", 
        "Software Engineer (full)", 
        "Chef",
        "Story Teller"]

ini_data = { "ROLES": ROLES,
            "OLLAMA_DATA": OLLAMA_DATA,
            "TRIGGER_KEYWORDS": TRIGGER_KEYWORDS,
            "ROLES": ROLES,
            "PROVIDERS": PROVIDERS,
            "HEADERS": HEADERS,
            "MAX_CONTEXT_LEN": MAX_CONTEXT_LEN,
            "OLLAMA_URL": OLLAMA_URL,
            "DEFAULT_MODEL": DEFAULT_MODEL,
            "DEFAULT_PROVIDER": DEFAULT_PROVIDER,
            "ROLES_ATTRIBUTE": ROLES_ATTRIBUTE
    }

with open("ini_data.json", "w", encoding="utf-8") as f:
    json.dump(ini_data, f) # indent=4) <- no indent: more efficient
