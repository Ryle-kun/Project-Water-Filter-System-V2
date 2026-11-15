# 💧 Water Filter System V2
### IoT-Based Water Monitoring and Distribution Control System

A full-stack IoT water monitoring and distribution control project designed for barangay water distribution. It monitors three water tanks, tracks flow rates and valve states, and provides a web dashboard for system monitoring and control.

> **Development status:** The web application and backend can be run locally. Physical Arduino/LoRa integration, deployment on the Raspberry Pi, and complete offline operation must be tested with the actual hardware and deployment environment. Do not treat simulated or placeholder readings as live sensor data.

---

## 1. System Overview

The water system is designed around three gravity-fed tanks:

| Tank | Capacity | Purpose |
|---|---:|---|
| Tank 1 | 2,000 L | Incoming water storage |
| Tank 2 | 2,000 L | Filtration stage |
| Tank 3 | 4,000 L | Filtered-water storage and distribution |

The design serves five tap stands. The intended hardware arrangement uses an Arduino Mega 2560 as the main controller, an Arduino Nano for the remote tap-stand controller, and LoRa SX1278 modules for wireless communication between controller locations. A Raspberry Pi is intended to host the local backend and dashboard.

The system is designed for locations where internet access may be limited. Local operation still depends on the server, network connection between the dashboard and server, and functioning hardware.

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 |
| Charts | Chart.js, react-chartjs-2 |
| Progressive Web App | vite-plugin-pwa |
| Backend API | Python, FastAPI |
| Database | MySQL |
| ORM | SQLAlchemy 2 (async) |
| Authentication | JWT |
| Real-time updates | WebSocket |
| Controller communication | Serial, pyserial-asyncio |
| Microcontrollers | Arduino Mega 2560, Arduino Nano |
| Wireless link | LoRa SX1278 |

## 3. Features

- Dashboard for three tank levels and water-flow information.
- Valve-state monitoring and valve command endpoints.
- Tap-stand schedule management endpoints.
- User authentication with role information.
- Sensor-reading history and alert endpoints.
- WebSocket support for real-time dashboard updates.
- Installable PWA with a web app manifest and service worker.

**PWA limitation:** Installation and service-worker registration have been checked using the production preview. Full offline functionality has not been verified. API requests, login, and live hardware data require the backend and its dependencies to be reachable.

## 4. Repository Structure

```text
Project-Water-Filter-System-V2/
├── arduino/
│   └── water_systems.ino
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── serial_bridge.py
│   ├── websocket_manager.py
│   ├── services/
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 5. Requirements

Install the following before setup:

- Git
- Python 3.10 or newer
- Node.js and npm
- MySQL (XAMPP can be used for local development)
- Visual Studio Code (recommended)

## 6. Setup Instructions

### Step 1 — Clone the repository

```bash
git clone https://github.com/Ryle-kun/Project-Water-Filter-System-V2.git
cd Project-Water-Filter-System-V2
git checkout dev
```

The `dev` branch contains the current development version. Use `main` only when you specifically need the stable branch.

### Step 2 — Create the MySQL database

1. Start MySQL in XAMPP (or start your MySQL server).
2. Open phpMyAdmin or another MySQL client.
3. Create a database named:

```sql
CREATE DATABASE water_system_db;
```

The current backend model configuration defaults to:

```text
mysql+aiomysql://root:@localhost:3306/water_system_db
```

If your MySQL username or password differs, set the appropriate connection string in the backend `.env` file.

### Step 3 — Configure and run the backend

Open a terminal at the repository root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install aiomysql
```

**Important:** The current `requirements.txt` does not yet list `aiomysql`, although the configured MySQL connection uses it. Install it separately using the command above.

Create a file named `.env` inside the `backend` folder:

```env
DATABASE_URL=mysql+aiomysql://root:@localhost:3306/water_system_db
SECRET_KEY=replace_with_a_long_random_secret
DEVICE_API_KEY=replace_with_a_different_random_device_key
SERIAL_PORT=COM3
BAUD_RATE=9600
```

Generate unique, strong values for `SECRET_KEY` and `DEVICE_API_KEY`. Change `SERIAL_PORT` to the correct port for the connected Arduino. Do not commit or share the `.env` file or its secrets.

Start the API:

```powershell
uvicorn main:app --reload
```

Local API address: http://127.0.0.1:8000

Interactive API documentation: http://127.0.0.1:8000/docs

### Step 4 — Configure and run the frontend

Open a **second terminal** at the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

The current frontend API configuration is in `frontend/src/constants.js` and points to `http://127.0.0.1:8000`. For another computer or a deployed server, update the API and WebSocket addresses to match that environment.

### Step 5 — Build and preview the PWA

From the `frontend` directory:

```powershell
npm run build
npm run preview
```

Vite writes the production build to `frontend/dist/`. The PWA plugin generates the web manifest and service worker as part of the production build.

## 7. Initial User Accounts

The current backend database seeding code creates these accounts when they do not already exist:

| Role | Username | Initial password |
|---|---|---|
| Administrator | `admin` | `password123` |
| Operator | `operator` | `password123` |
| Official | `official` | `password123` |

These are development credentials. Change them before any real deployment and do not use these defaults in a production environment. Existing database users are not automatically reset when the application starts.

## 8. Hardware and Serial Communication

The backend serial bridge is configured through:

| Variable | Purpose |
|---|---|
| `SERIAL_PORT` | Arduino serial port (for example, `COM3` on Windows or `/dev/ttyUSB0` on Linux) |
| `BAUD_RATE` | Serial communication speed; default is `9600` |
| `DEVICE_API_KEY` | Shared key used to authenticate device readings |

The bridge expects newline-delimited JSON data from the controller and forwards sensor readings to the backend API using the `X-Device-Key` header. Valve commands are queued for serial transmission.

The backend can start without an Arduino attached, but hardware monitoring and control will not work until the correct controller, serial port, firmware, and wiring are connected and tested.

## 9. Current Development Notes

- The backend's sensor simulation task is disabled in the current startup configuration.
- The automatic schedule-checker task is also disabled in the current startup configuration.
- Do not assume dashboard values are live hardware readings unless the Arduino data path has been connected and verified.
- The frontend currently uses a local API address; update it when accessing the backend from another device.
- The PWA can be installed, but complete offline operation has not been validated.
- The current backend requirements file should be updated to include `aiomysql` so a separate installation step is no longer necessary.

## 10. Git Branch Workflow

| Branch | Purpose |
|---|---|
| `main` | Stable version |
| `dev` | Integration and development |
| `feature/*` | Individual features and fixes |

Contributors should create a feature branch from `dev`, commit their changes there, and submit them for review before merging into `dev`. Avoid pushing unreviewed work directly to `main`.

---

## Repository

GitHub: https://github.com/Ryle-kun/Project-Water-Filter-System-V2

**Project:** Water Filter System V2  
**Project type:** IoT Monitoring and Water Distribution Control  
**Purpose:** Thesis / Capstone Project
