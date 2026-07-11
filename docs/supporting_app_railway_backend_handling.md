Go to **[railway.app](https://railway.app)** → your project → click your **backend service** → then:

1. Click the **"Variables"** tab
2. Click **"New Variable"** (or "Add Variable" / "+ Raw Editor")
3. Add each key-value pair

Here's a screenshot guide of what to look for — take a screenshot of your Railway dashboard and I can point you to the exact button if you get stuck.

The fastest way is the **Raw Editor**:
1. Variables tab → click **"Raw Editor"**
2. Paste all variables at once:

```
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST/YOUR_DB_NAME?sslmode=require
ADMIN_EMAILS=admin@aimathcopilot.com
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD_HERE
SECRET_KEY=YOUR_SECRET_KEY_HERE
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE
DEFAULT_MODEL=gpt-4o
APP_ENV=production
FRONTEND_URL=https://your-app.vercel.app
```

For `SECRET_KEY`, run this first in your terminal to generate one:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Then paste the output as the value.








# To redeploy, run in your terminal:
# ste 1: bash# Backend
cd backend
railway up

# step 2: Frontend change and run when new additions are made
cd apps/math-copilot
npm run build
vercel --prod
