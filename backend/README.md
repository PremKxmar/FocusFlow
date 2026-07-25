# FocusFlow Backend

Python Flask backend with MongoDB and ML-based productivity forecasting.

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Setup MongoDB
Make sure MongoDB is running locally on port 27017, or update `MONGO_URI` in `.env`.

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Seed Database (Optional)
```bash
python seed.py
```

### 5. Run Server
```bash
python app.py
```

Server runs on http://localhost:5000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/<id>` - Update task
- `DELETE /api/tasks/<id>` - Delete task

### Activities
- `POST /api/activities` - Log activity
- `GET /api/activities/summary` - Daily summary
- `GET /api/activities/weekly` - Weekly trends

### Focus
- `POST /api/focus/start` - Start focus session
- `POST /api/focus/end` - End focus session
- `GET /api/focus/stats` - Focus statistics

### Insights
- `GET /api/insights/dashboard` - Dashboard data
- `GET /api/insights/forecast` - ML predictions
- `GET /api/insights/trends` - Time-series data

## Demo User

Demo seeding is **off by default**. To create a throwaway local account, set the
following in `.env` before starting the server:

```
SEED_DEMO_USER=true
DEMO_USER_EMAIL=demo@focusflow.local
DEMO_USER_PASSWORD=<pick your own>
```

Leave `SEED_DEMO_USER=false` in any deployed environment.

See the [root README](../README.md) for the full API reference, architecture notes,
and deployment instructions.
