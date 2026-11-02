# JEV AI Engine Setup Guide (Linux & Windows)

This guide provides step-by-step instructions for setting up and running the **JEV AI Decision Engine** (TypeSafe System One Engine) on both Linux and Windows operating systems.

---

## Prerequisites

Before starting, ensure you have the following:

- **Python**: Version 3.8 or higher.
- **Package Manager**: `pip` (Python package manager).
- **API Key**: A valid TypeSafe API key obtained from the [TypeSafe Console](https://console.typesafe.ai).

To check your Python version, run:
```bash
python3 --version   # On Linux / macOS
python --version    # On Windows
```

---

## 1. Setup on Linux

### Step 1: Create a Virtual Environment (Recommended)

Open your terminal and execute:

```bash
# Navigate to your project directory
mkdir jev-demo && cd jev-demo

# Create virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate
```

### Step 2: Set the API Key Environment Variable

#### Temporary (Current Terminal Session Only):
```bash
export TYPESAFE_API_KEY="sk-your-api-key-here"
```

#### Permanent Setup:
Add the export statement to your shell configuration file (`~/.bashrc` or `~/.zshrc`):

```bash
echo 'export TYPESAFE_API_KEY="sk-your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

Verify that the variable is set:
```bash
echo $TYPESAFE_API_KEY
```

### Step 3: Install Required Dependencies

```bash
pip install --upgrade pip
pip install typesafe-sdk requests
```

---

## 2. Setup on Windows

### Step 1: Create a Virtual Environment (Recommended)

Open **Command Prompt (CMD)** or **PowerShell**:

#### Command Prompt (CMD):
```cmd
mkdir jev-demo
cd jev-demo
python -m venv venv
venv\Scripts\activate.bat
```

#### PowerShell:
```powershell
mkdir jev-demo
cd jev-demo
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(Note: If PowerShell throws an `Execution_Policies` error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first.)*

### Step 2: Set the API Key Environment Variable

#### Command Prompt (CMD):
```cmd
:: Temporary (Current Session)
set TYPESAFE_API_KEY=sk-your-api-key-here

:: Permanent
setx TYPESAFE_API_KEY "sk-your-api-key-here"
```

#### PowerShell:
```powershell
# Temporary (Current Session)
$env:TYPESAFE_API_KEY="sk-your-api-key-here"

# Permanent
[System.Environment]::SetEnvironmentVariable('TYPESAFE_API_KEY', 'sk-your-api-key-here', 'User')
```

Verify that the variable is set:
```powershell
# In CMD:
echo %TYPESAFE_API_KEY%

# In PowerShell:
echo $env:TYPESAFE_API_KEY
```

### Step 3: Install Required Dependencies

```cmd
python -m pip install --upgrade pip
pip install typesafe-sdk requests
```

---

## 3. Quick Start & Demo Script

Create a file named `demo.py` in your project folder and add the following code:

```python
import os
import json
from typesafe_sdk import TypeSafeClient, Choice, Noul, Score

# 1. Initialize client
api_key = os.getenv("TYPESAFE_API_KEY")
if not api_key:
    raise ValueError("TYPESAFE_API_KEY environment variable is not set!")

client = TypeSafeClient(api_key=api_key)

# 2. Define state (Context)
ticket_context = {
    "ticket_id": "INC-8821",
    "user_tier": "enterprise",
    "description": "Our primary database cluster went down after applying the patch. System throws connection timeout error."
}

# 3. Define System One Primitive Questions
questions = {
    "routing": Choice(
        instructions="Classify which internal department should handle this request.",
        options={
            "devops": "Database, server downtime, connection timeouts, cluster failures",
            "billing": "Invoices, payment failures, subscription updates",
            "support": "General questions, account guidance"
        }
    ),
    "is_outage": Noul(
        instructions="Does this describe a critical service outage?"
    ),
    "severity": Score(
        instructions="Rate the incident urgency level.",
        levels=["Low (P3)", "Medium (P2)", "Critical (P1)"]
    )
}

# 4. Query JEV Engine
print("Sending request to JEV System One engine...")
response = client.system_one(
    state=ticket_context,
    questions=questions,
    model="jev-latest"
)

# 5. Display Outputs
answers = response.answers
print("\n--- DECISION OUTPUT ---")
print(f"Target Department : {answers['routing'].choice.winner}")
print(f"Routing Confidence: {answers['routing'].choice.confidence * 100:.1f}%")
print(f"Critical Outage   : {answers['is_outage'].noul > 0.5} (Probability: {answers['is_outage'].noul:.2f})")
print(f"Assigned Severity : {answers['severity'].score.winner}")
```

### Run the Script

- **Linux**:
  ```bash
  python3 demo.py
  ```
- **Windows**:
  ```cmd
  python demo.py
  ```

---

## 4. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `ValueError: TYPESAFE_API_KEY...` | Environment variable not detected. | Ensure you set the environment variable in the active terminal window or restart terminal after using `setx` / `SetEnvironmentVariable`. |
| `ModuleNotFoundError` | `typesafe-sdk` not installed in active environment. | Verify virtual environment activation (`venv`) and run `pip install typesafe-sdk`. |
| Connection Timeout | Firewall or network blocking outbound requests. | Ensure traffic to `https://api.typesafe.ai` is allowed over port 443. |