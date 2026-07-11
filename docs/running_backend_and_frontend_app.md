# Backend

 The backend is live at https://humorous-love-production-e447.up.railway.app.





 # Frontend
 Frontend is deployed! 

- **Live URL:** https://math-copilot.vercel.app

Now two final steps to wire frontend ↔ backend:

**1. Set the API URL in Vercel** (so the frontend knows where the backend is):Paste that → Enter. It will ask for the value — type:
```
https://humorous-love-production-e447.up.railway.app/api/v1
```

**2. Update FRONTEND_URL in Railway** (so CORS allows requests from Vercel):That second command is in your clipboard for after the first is done. Then one final `vercel --prod` to rebuild with the new env var, and everything is connected.


# run frontend
vercel --prod





# running backend and frontend
That's a **backend** command — it updates the Railway backend so it allows CORS requests from your Vercel frontend URL.

You need to `cd` back to the backend folder first before running it. So the sequence is:

**1.** Navigate back to backend:
```
cd "C:\Users\drdanoye\My_AI_Projects\SaaS_Apps\prompt-engineering-marketplace\Prompt Engineering Marketplace\AI-STEM-COPILOT\backend"
```

**2.** Set the CORS variable:
```
railway variables set "FRONTEND_URL=https://math-copilot.vercel.app"
```

**3.** Then `cd` back to the frontend:
```
cd "C:\Users\drdanoye\My_AI_Projects\SaaS_Apps\prompt-engineering-marketplace\Prompt Engineering Marketplace\AI-STEM-COPILOT\apps\math-copilot"
```

**4.** Redeploy frontend:
```
vercel --prod
```