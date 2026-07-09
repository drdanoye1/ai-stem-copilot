Go to **neon.tech**, sign up free, create a database called `math_copilot`, then copy the connection string (it looks like `postgresql://user:password@xxx.neon.tech/math_copilot?sslmode=require`).

While you do that, I'll switch the code back to asyncpg (which is what Promptivia uses with Neon):Code is ready. Once you have the Neon connection string, paste it here and I'll set it in Railway and deploy in one go.


# using and updating database in neon:
You already have a **`math_copilot`** project on Neon — that's exactly what we need. Now get the connection string from it:

1. Click **`math_copilot`** in the project list
2. On the project dashboard, look for **"Connection Details"** or **"Connect"** button
3. In the connection string dropdown, select **"Prisma"** or **"Node.js"** — then switch the driver to **`asyncpg`** (or just copy the base URL)

The string will look like:
```
postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Change `postgresql://` → `postgresql+asyncpg://` and share it here (or paste it directly into `backend/.env` as `DATABASE_URL`).

Once you have it, I'll:
1. Update `.env` with the real URL
2. Run the Alembic migration to create all tables in that Neon DB
3. Update the Railway backend env vars reference