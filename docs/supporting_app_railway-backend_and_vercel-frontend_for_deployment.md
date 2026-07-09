# To redeploy, run in your terminal:
# ste 1: bash# Backend
cd backend
railway up

# step 2: Frontend change and run when new additions are made
cd apps/math-copilot
npm run build
vercel --prod
