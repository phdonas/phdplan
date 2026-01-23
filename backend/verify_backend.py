
import requests
import sys

BASE_URL = "http://localhost:8000"

def test_insight_persistence():
    print("Testing Insight persistence...")
    
    # 1. Create Insight
    payload = {
        "descricao": "Test Insight Persistence",
        "categoria": "Geral",
        "o_que": "Test O Que",
        "como": "Test Como",
        "onde": "Test Onde",
        "cta": "Test CTA",
        "duracao": "30m",
        "kpi_meta": "Test KPI",
        "tipo_dia": "Normal",
        "dia_semana": "Segunda",
        "tema_macro": "Test Macro",
        "angulo": "Test Angulo",
        "canal_area": "Test Canal",
        "prioridade": "Alta"
    }
    
    print(f"Creating insight with payload: {payload}")
    try:
        response = requests.post(f"{BASE_URL}/insights", json=payload)
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to backend. Is it running?")
        sys.exit(1)
        
    if response.status_code != 200:
        print(f"Error creating insight: {response.text}")
        sys.exit(1)
        
    data = response.json()
    insight_id = data["id"]
    print(f"Created Insight ID: {insight_id}")
    
    # Verify fields in creation response
    for key, value in payload.items():
        if data.get(key) != value:
            print(f"MISMATCH in Creation response! {key}: expected '{value}', got '{data.get(key)}'")
            
    # 2. Get Insight via GET
    print(f"Retrieving Insight ID: {insight_id}")
    response = requests.get(f"{BASE_URL}/insights")
    if response.status_code != 200:
         print(f"Error getting insights: {response.text}")
         sys.exit(1)
         
    insights = response.json()
    target = next((i for i in insights if i['id'] == insight_id), None)
    
    if not target:
        print("Insight not found in list!")
        sys.exit(1)
        
    # Verify fields in GET response
    print("Verifying GET persistence...")
    mismatch = False
    for key, value in payload.items():
        if target.get(key) != value:
            print(f"MISMATCH in GET! {key}: expected '{value}', got '{target.get(key)}'")
            mismatch = True
            
    if mismatch:
        print("FAILURE: Data not persisted correctly.")
    else:
        print("SUCCESS: Data persisted correctly.")

if __name__ == "__main__":
    test_insight_persistence()
