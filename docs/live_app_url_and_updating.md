  Production      https://math-copilot-1fv3fmyha-dr-david-noyes-projects.vercel.app
▲ Aliased         https://math-copilot.vercel.app





# updating app

# Step 1- backend
cd backend
railway up

# step 2- frontend
cd apps/math-copilot
vercel --prod


# step 2b- frontned (to confirm clean compilation)
cd apps\math-copilot
npm run build
vercel --prod





# To redeploy, run in your terminal:
# ste 1: bash# Backend
cd backend
railway up

# step 2: Frontend change and run when new additions are made
cd apps/math-copilot
npm run build
vercel --prod
