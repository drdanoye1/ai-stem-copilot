"""
Discovery Projects™ — database models.
Projects are seeded at startup; submissions store user work + AI feedback.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title           = Column(String(200), nullable=False)
    subject         = Column(String(60), nullable=False)   # algebra | calculus | statistics | geometry | linear_algebra | differential_equations
    level           = Column(String(40), nullable=False)   # high_school | university | graduate
    description     = Column(Text, nullable=False)
    difficulty      = Column(Integer, default=2)           # 1–5 stars
    estimated_hours = Column(Float, default=1.0)
    tags            = Column(JSONB, default=list)
    steps_json      = Column(JSONB, default=list)          # [{step, instruction, hint}]
    rubric_json     = Column(JSONB, default=list)          # [{criterion, weight, description}]
    starter_context = Column(Text, default="")             # additional context fed to AI feedback
    pro_only        = Column(Boolean, default=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProjectSubmission(Base):
    __tablename__ = "project_submissions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    user_id     = Column(UUID(as_uuid=True), nullable=False)
    work_text   = Column(Text, nullable=False)
    ai_feedback = Column(JSONB, default=dict)   # {score, verdict, strengths, improvements, next_steps}
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ── Seed data ─────────────────────────────────────────────────────────────────

SEED_PROJECTS = [
    # ── Algebra ──────────────────────────────────────────────────────────────
    {
        "title": "Projectile Motion Modeller",
        "subject": "algebra",
        "level": "high_school",
        "description": "Build a quadratic model for a basketball free throw. Determine the optimal launch angle and height to guarantee a score, then verify using the quadratic formula.",
        "difficulty": 2,
        "estimated_hours": 1.5,
        "tags": ["quadratics", "modelling", "real-world"],
        "steps_json": [
            {"step": 1, "instruction": "Set up coordinate axes with the release point at (0, 2.5 m). Write the general quadratic path h(x) = ax² + bx + c.", "hint": "The initial height gives you c directly."},
            {"step": 2, "instruction": "The basket is at x = 4.57 m, h = 3.05 m. The ball must reach a maximum height of at least 3.5 m. Use these constraints to solve for a and b.", "hint": "Two points + vertex condition = three equations."},
            {"step": 3, "instruction": "Find the launch angle θ using the derivative h′(0) = tan(θ). Convert to degrees.", "hint": "tan(θ) = b when a = 0 at x = 0."},
            {"step": 4, "instruction": "Use the quadratic formula to confirm the ball crosses h = 3.05 m at exactly x = 4.57 m. Interpret the two roots.", "hint": "One root is the basket; the other is where the ball exits the other side."},
        ],
        "rubric_json": [
            {"criterion": "Model setup", "weight": 20, "description": "Correct axes, initial conditions, and general form"},
            {"criterion": "Constraint equations", "weight": 30, "description": "Two constraints correctly formulated and solved"},
            {"criterion": "Launch angle derivation", "weight": 25, "description": "Correct use of derivative and arc-tan"},
            {"criterion": "Quadratic formula verification", "weight": 25, "description": "Correct calculation and interpretation of both roots"},
        ],
        "starter_context": "This is a projectile motion problem modelled with a quadratic equation on flat ground.",
    },
    {
        "title": "Break-Even Analysis",
        "subject": "algebra",
        "level": "high_school",
        "description": "A startup sells software subscriptions. Revenue is R(x) = 49x and total cost is C(x) = 12x + 8500. Find the break-even point, profit function, and optimal pricing strategy.",
        "difficulty": 2,
        "estimated_hours": 1.0,
        "tags": ["linear-equations", "business", "functions"],
        "steps_json": [
            {"step": 1, "instruction": "Write the profit function P(x) = R(x) − C(x). Simplify.", "hint": "Subtract cost from revenue."},
            {"step": 2, "instruction": "Solve P(x) = 0 to find the break-even quantity. Interpret in context.", "hint": "Set R(x) = C(x)."},
            {"step": 3, "instruction": "If fixed costs rise to $12,000, find the new break-even point. By what percentage did it change?", "hint": "Resolve with the new c value."},
            {"step": 4, "instruction": "The company targets a monthly profit of $15,000. How many subscriptions are needed? What is the revenue at that point?", "hint": "Set P(x) = 15000 and solve."},
        ],
        "rubric_json": [
            {"criterion": "Profit function", "weight": 20, "description": "Correct simplification of P(x)"},
            {"criterion": "Break-even calculation", "weight": 30, "description": "Correct algebra and contextual interpretation"},
            {"criterion": "Sensitivity analysis", "weight": 25, "description": "Correct recalculation and % change"},
            {"criterion": "Target profit", "weight": 25, "description": "Correct solution and revenue calculation"},
        ],
        "starter_context": "Break-even analysis uses linear equations; profit is the difference between revenue and cost functions.",
    },
    # ── Calculus ─────────────────────────────────────────────────────────────
    {
        "title": "Optimal Container Design",
        "subject": "calculus",
        "level": "high_school",
        "description": "A tin manufacturer wants a cylindrical can with volume exactly 500 cm³ using the minimum amount of metal. Find the optimal radius and height using calculus.",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["optimisation", "derivatives", "real-world"],
        "steps_json": [
            {"step": 1, "instruction": "Write the volume constraint V = πr²h = 500. Solve for h in terms of r.", "hint": "h = 500 / (πr²)"},
            {"step": 2, "instruction": "Write the surface area A(r) = 2πr² + 2πrh. Substitute h and simplify to a single-variable function.", "hint": "A(r) = 2πr² + 1000/r"},
            {"step": 3, "instruction": "Find A′(r). Set A′(r) = 0 to find the critical point.", "hint": "Use the power rule on 1000/r = 1000r⁻¹."},
            {"step": 4, "instruction": "Use the second derivative test to confirm it is a minimum. Calculate the optimal r, h, and minimum surface area.", "hint": "A″(r) > 0 confirms minimum."},
        ],
        "rubric_json": [
            {"criterion": "Constraint setup", "weight": 20, "description": "Correct volume equation and h substitution"},
            {"criterion": "Objective function", "weight": 25, "description": "Correct single-variable surface area function"},
            {"criterion": "Critical point", "weight": 30, "description": "Correct derivative and zero-finding"},
            {"criterion": "Second derivative test", "weight": 25, "description": "Correct confirmation of minimum and final values"},
        ],
        "starter_context": "Optimisation problem: minimise surface area of a cylinder subject to a fixed volume constraint.",
    },
    {
        "title": "Related Rates — Filling a Cone",
        "subject": "calculus",
        "level": "high_school",
        "description": "Water fills a conical tank (radius 3 m, height 10 m, apex down) at 2 m³/min. How fast is the water level rising when the depth is 5 m?",
        "difficulty": 3,
        "estimated_hours": 1.0,
        "tags": ["related-rates", "implicit-differentiation", "chain-rule"],
        "steps_json": [
            {"step": 1, "instruction": "Write the volume of a cone V = (1/3)πr²h. Use similar triangles to write r as a function of h only.", "hint": "r/h = 3/10, so r = 3h/10."},
            {"step": 2, "instruction": "Substitute to get V as a function of h alone. Simplify.", "hint": "V = (3π/100)h³"},
            {"step": 3, "instruction": "Differentiate both sides with respect to time t. Identify dV/dt and solve for dh/dt.", "hint": "dV/dt = (9π/100)h² · dh/dt"},
            {"step": 4, "instruction": "Substitute h = 5 and dV/dt = 2. Calculate dh/dt. Include units and interpret in words.", "hint": "Units: m/min."},
        ],
        "rubric_json": [
            {"criterion": "Similar triangles", "weight": 20, "description": "Correct r(h) relationship"},
            {"criterion": "Volume reduction", "weight": 25, "description": "Correct single-variable V(h)"},
            {"criterion": "Implicit differentiation", "weight": 30, "description": "Correct chain rule application"},
            {"criterion": "Numerical answer + interpretation", "weight": 25, "description": "Correct dh/dt with units and context"},
        ],
        "starter_context": "Related rates problem requiring implicit differentiation and geometric similar-triangle reasoning.",
    },
    {
        "title": "Area Between Curves — Income Distribution",
        "subject": "calculus",
        "level": "university",
        "description": "A country's Lorenz curve is L(x) = x². Compute the Gini coefficient — the ratio of the area between perfect equality and the actual Lorenz curve to the total area under perfect equality.",
        "difficulty": 4,
        "estimated_hours": 2.0,
        "tags": ["integration", "area", "economics"],
        "steps_json": [
            {"step": 1, "instruction": "Sketch the perfect equality line y = x and the Lorenz curve y = x² on [0,1]. Shade the area between them.", "hint": "The shaded region is bounded above by y=x and below by y=x²."},
            {"step": 2, "instruction": "Compute ∫₀¹ (x − x²) dx. Show all integration steps.", "hint": "Integrate term-by-term."},
            {"step": 3, "instruction": "The Gini coefficient G = 2 × (area between curves). Calculate G for this country.", "hint": "The factor of 2 normalises by the triangle area of 0.5."},
            {"step": 4, "instruction": "If the Lorenz curve were L(x) = x^0.5, recalculate G. Which country is more equal? Explain mathematically.", "hint": "A Gini of 0 means perfect equality; 1 means maximum inequality."},
        ],
        "rubric_json": [
            {"criterion": "Sketch and setup", "weight": 20, "description": "Correct region identification"},
            {"criterion": "Definite integral", "weight": 30, "description": "Correct integration and evaluation"},
            {"criterion": "Gini coefficient", "weight": 25, "description": "Correct G calculation"},
            {"criterion": "Comparison and interpretation", "weight": 25, "description": "Correct second G and economic interpretation"},
        ],
        "starter_context": "The Gini coefficient measures income inequality using the area between the Lorenz curve and perfect equality line.",
    },
    # ── Statistics ────────────────────────────────────────────────────────────
    {
        "title": "Regression Investigation — House Prices",
        "subject": "statistics",
        "level": "high_school",
        "description": "Use the following dataset (size in m², price in $000): (60,180), (75,220), (90,265), (110,310), (130,370), (150,420). Find the least-squares regression line and use it to predict and evaluate.",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["regression", "correlation", "prediction"],
        "steps_json": [
            {"step": 1, "instruction": "Calculate x̄ and ȳ. Then compute Σ(xᵢ−x̄)², Σ(xᵢ−x̄)(yᵢ−ȳ). Show your working.", "hint": "Build a table with columns for xᵢ, yᵢ, (xᵢ−x̄), (yᵢ−ȳ), products, squares."},
            {"step": 2, "instruction": "Calculate the slope b₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)² and intercept b₀ = ȳ − b₁x̄.", "hint": "Use your sums from step 1."},
            {"step": 3, "instruction": "Compute the correlation coefficient r. Interpret its value.", "hint": "r = Σ(xᵢ−x̄)(yᵢ−ȳ) / √[Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²]"},
            {"step": 4, "instruction": "Predict the price of a 100 m² house. Also state the range within which this prediction is valid and why.", "hint": "Interpolation vs. extrapolation — only trust predictions inside the data range."},
        ],
        "rubric_json": [
            {"criterion": "Summary statistics", "weight": 20, "description": "Correct means and deviation products"},
            {"criterion": "Regression coefficients", "weight": 30, "description": "Correct b₁ and b₀"},
            {"criterion": "Correlation coefficient", "weight": 25, "description": "Correct r and interpretation"},
            {"criterion": "Prediction and validity", "weight": 25, "description": "Correct prediction with appropriate caveat"},
        ],
        "starter_context": "Linear regression project using manual computation of least-squares coefficients and Pearson's r.",
    },
    {
        "title": "Hypothesis Test — Does Tutoring Work?",
        "subject": "statistics",
        "level": "university",
        "description": "A class of 30 students sat a test before and after tutoring. The mean improvement was 8.2 marks, with sample standard deviation 14.1. Test at the 5% level whether tutoring significantly improved scores.",
        "difficulty": 4,
        "estimated_hours": 2.0,
        "tags": ["hypothesis-testing", "t-test", "inference"],
        "steps_json": [
            {"step": 1, "instruction": "State H₀ and H₁. Identify this as a one-sample t-test on the differences. Justify the choice of one-tailed vs. two-tailed.", "hint": "H₀: μ_d = 0; H₁: μ_d > 0 (one-tailed, since we hypothesise improvement)."},
            {"step": 2, "instruction": "Calculate the t-statistic: t = (x̄_d − 0) / (s_d / √n).", "hint": "t = 8.2 / (14.1 / √30)"},
            {"step": 3, "instruction": "Find the critical value t* for df = 29 at α = 0.05 one-tailed. State the decision rule.", "hint": "t* ≈ 1.699 from t-tables."},
            {"step": 4, "instruction": "State your conclusion in context. Also compute the p-value qualitatively (is it above or below 0.05?) and explain what a Type I error would mean here.", "hint": "Compare computed t to t*. A Type I error would be claiming tutoring works when it doesn't."},
        ],
        "rubric_json": [
            {"criterion": "Hypotheses", "weight": 20, "description": "Correct H₀, H₁ and test direction"},
            {"criterion": "Test statistic", "weight": 30, "description": "Correct t calculation"},
            {"criterion": "Critical value + decision", "weight": 25, "description": "Correct critical value and decision rule"},
            {"criterion": "Conclusion + Type I error", "weight": 25, "description": "Correct contextual conclusion and error explanation"},
        ],
        "starter_context": "One-sample t-test on paired differences to determine if a treatment caused statistically significant improvement.",
    },
    {
        "title": "Normal Distribution Investigation",
        "subject": "statistics",
        "level": "high_school",
        "description": "IQ scores follow N(100, 15²). Calculate probabilities, percentiles, and unusual scores, then explore the Central Limit Theorem by considering samples.",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["normal-distribution", "z-scores", "CLT"],
        "steps_json": [
            {"step": 1, "instruction": "Find P(IQ > 130). Standardise to a z-score and use the standard normal table.", "hint": "z = (130−100)/15"},
            {"step": 2, "instruction": "Find the IQ score at the 95th percentile. Show the z-to-x conversion.", "hint": "x = μ + zσ, z₀.₉₅ ≈ 1.645"},
            {"step": 3, "instruction": "Find P(85 < IQ < 115). Interpret this as the proportion of 'typical' scorers.", "hint": "Find two z-scores and subtract probabilities."},
            {"step": 4, "instruction": "For samples of n=25, describe the sampling distribution of X̄. Find P(X̄ > 103). Explain why this probability differs from P(X > 103).", "hint": "σ_X̄ = σ/√n. Use the CLT."},
        ],
        "rubric_json": [
            {"criterion": "z-score conversion", "weight": 20, "description": "Correct standardisation for P(X > 130)"},
            {"criterion": "Percentile calculation", "weight": 25, "description": "Correct reverse lookup"},
            {"criterion": "Interval probability", "weight": 25, "description": "Correct two-sided calculation"},
            {"criterion": "CLT application", "weight": 30, "description": "Correct sampling distribution and conceptual explanation"},
        ],
        "starter_context": "Normal distribution problems involving z-scores, percentiles, and the Central Limit Theorem.",
    },
    # ── Geometry ──────────────────────────────────────────────────────────────
    {
        "title": "Circle Theorem Proof Portfolio",
        "subject": "geometry",
        "level": "high_school",
        "description": "Prove three circle theorems from first principles: (1) the angle at the centre is twice the angle at the circumference, (2) angles in the same segment are equal, (3) opposite angles of a cyclic quadrilateral sum to 180°.",
        "difficulty": 4,
        "estimated_hours": 2.5,
        "tags": ["proof", "circles", "theorems"],
        "steps_json": [
            {"step": 1, "instruction": "Draw a circle with centre O. Points A, B, P on the circle. Prove ∠AOB = 2∠APB using isoceles triangles formed by radii.", "hint": "Join OP and use the exterior angle theorem on each isoceles triangle."},
            {"step": 2, "instruction": "Using Theorem 1, prove that all inscribed angles subtending the same arc are equal.", "hint": "Both angles = half the central angle over the same arc."},
            {"step": 3, "instruction": "For cyclic quadrilateral ABCD, use Theorem 1 to prove ∠A + ∠C = 180°.", "hint": "∠A and ∠C subtend arcs that together make the full circle (360°). Apply Theorem 1."},
            {"step": 4, "instruction": "Give one real-world application of each theorem. For instance, where does the inscribed angle theorem appear in engineering or design?", "hint": "Cameras, headlamps, bridge arches..."},
        ],
        "rubric_json": [
            {"criterion": "Theorem 1 proof", "weight": 30, "description": "Rigorous proof with clear diagram and steps"},
            {"criterion": "Theorem 2 proof", "weight": 25, "description": "Correct logical deduction from Theorem 1"},
            {"criterion": "Theorem 3 proof", "weight": 25, "description": "Correct cyclic quadrilateral proof"},
            {"criterion": "Applications", "weight": 20, "description": "Relevant, accurate real-world connections"},
        ],
        "starter_context": "Euclidean circle theorem proofs using inscribed angles and cyclic quadrilaterals.",
    },
    {
        "title": "Trigonometry in Architecture",
        "subject": "geometry",
        "level": "high_school",
        "description": "A suspension bridge has two towers 400 m apart and 80 m tall. The parabolic cable sags to 10 m above the road at midspan. Calculate angles, cable length, and forces on anchor points.",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["trigonometry", "vectors", "engineering"],
        "steps_json": [
            {"step": 1, "instruction": "Model the cable as a parabola with vertex at (200, 10) and endpoints at (0, 80) and (400, 80). Find the equation y = a(x−200)² + 10.", "hint": "Substitute (0, 80) to find a."},
            {"step": 2, "instruction": "At the tower base (x = 0), find the angle the cable makes with the horizontal using the derivative y′(0).", "hint": "θ = arctan(|y′(0)|)"},
            {"step": 3, "instruction": "Approximate the cable length from the tower to mid-span using the arc length formula ∫₀²⁰⁰ √(1 + [y′(x)]²) dx. Simplify and estimate numerically.", "hint": "Use a simple numerical approximation — split into 4 equal sections."},
            {"step": 4, "instruction": "If the vertical component of cable tension is 500 kN at each anchor, calculate the horizontal tension using your angle from Step 2. Interpret what this means structurally.", "hint": "T_horizontal = T_vertical / tan(θ)"},
        ],
        "rubric_json": [
            {"criterion": "Parabola equation", "weight": 20, "description": "Correct a found using the given point"},
            {"criterion": "Cable angle", "weight": 25, "description": "Correct derivative and arctan calculation"},
            {"criterion": "Arc length", "weight": 30, "description": "Correct formula setup and reasonable estimate"},
            {"criterion": "Force calculation", "weight": 25, "description": "Correct trigonometric force resolution"},
        ],
        "starter_context": "Applied trigonometry and parabolic modelling in a civil engineering context.",
    },
    # ── Linear Algebra ────────────────────────────────────────────────────────
    {
        "title": "Matrix Transformation Portfolio",
        "subject": "linear_algebra",
        "level": "university",
        "description": "Explore 2D linear transformations as matrices. Compute the effect of rotation, reflection, and scaling on a triangle with vertices A(1,0), B(3,0), C(2,2).",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["matrices", "transformations", "eigenvectors"],
        "steps_json": [
            {"step": 1, "instruction": "Apply a 60° anti-clockwise rotation matrix to each vertex. Write the rotation matrix and show the matrix multiplication for vertex C(2,2).", "hint": "R(θ) = [[cos θ, −sin θ],[sin θ, cos θ]]"},
            {"step": 2, "instruction": "Apply a reflection in the line y = x to the original triangle. Write the reflection matrix and compute all three new vertices.", "hint": "M = [[0,1],[1,0]]"},
            {"step": 3, "instruction": "Combine: first rotate 60°, then reflect in y = x. Express as a single matrix product M·R. Apply to vertex B(3,0).", "hint": "Combined = M × R (note order matters!)"},
            {"step": 4, "instruction": "Find the eigenvalues and eigenvectors of the rotation matrix R(60°). Interpret what they tell you about the geometry of rotation.", "hint": "Eigenvalues will be complex — what does this mean geometrically?"},
        ],
        "rubric_json": [
            {"criterion": "Rotation", "weight": 25, "description": "Correct matrix and transformed coordinates"},
            {"criterion": "Reflection", "weight": 25, "description": "Correct matrix and all three vertices"},
            {"criterion": "Composition", "weight": 25, "description": "Correct product matrix and application"},
            {"criterion": "Eigenvalues", "weight": 25, "description": "Correct calculation and geometric interpretation"},
        ],
        "starter_context": "2D linear transformation matrices including rotation, reflection, and matrix composition.",
    },
    {
        "title": "PageRank — Network Mathematics",
        "subject": "linear_algebra",
        "level": "university",
        "description": "Model a mini-web of 4 pages. Build the Google transition matrix, apply the PageRank algorithm, and find the steady-state importance vector using eigenvectors.",
        "difficulty": 5,
        "estimated_hours": 3.0,
        "tags": ["eigenvectors", "Markov-chains", "networks"],
        "steps_json": [
            {"step": 1, "instruction": "Pages: A→{B,C}, B→{C}, C→{A,B,D}, D→{A}. Build the link matrix L where Lᵢⱼ = 1/|outlinks(j)| if j→i, else 0.", "hint": "Each column sums to 1 (or 0 for dangling nodes)."},
            {"step": 2, "instruction": "Apply the damping factor d=0.85: M = d·L + (1−d)/n · J where J is the all-ones matrix / n. Write out M explicitly.", "hint": "n=4, so (1−d)/n = 0.15/4 = 0.0375"},
            {"step": 3, "instruction": "Start with equal rank vector r = [0.25, 0.25, 0.25, 0.25]ᵀ. Apply r ← M·r three times. Show each iteration.", "hint": "Power iteration converges to the dominant eigenvector."},
            {"step": 4, "instruction": "What is the dominant eigenvalue of a stochastic matrix? Explain why power iteration converges for PageRank. Which page has the highest rank?", "hint": "The dominant eigenvalue of any column-stochastic matrix is 1."},
        ],
        "rubric_json": [
            {"criterion": "Link matrix", "weight": 25, "description": "Correct L with column sums = 1"},
            {"criterion": "Damped matrix", "weight": 25, "description": "Correct M construction"},
            {"criterion": "Power iteration", "weight": 30, "description": "Three correct iterations shown"},
            {"criterion": "Convergence explanation", "weight": 20, "description": "Correct eigenvalue argument and final ranking"},
        ],
        "starter_context": "The PageRank algorithm models web page importance as the dominant eigenvector of a stochastic transition matrix.",
    },
    # ── Differential Equations ────────────────────────────────────────────────
    {
        "title": "Newton's Law of Cooling",
        "subject": "differential_equations",
        "level": "university",
        "description": "A cup of coffee (90°C) cools in a room (20°C). After 10 min it is 70°C. Model the temperature using Newton's Law of Cooling and predict when it is drinkable (≤60°C).",
        "difficulty": 3,
        "estimated_hours": 1.5,
        "tags": ["ODEs", "exponential-decay", "separable"],
        "steps_json": [
            {"step": 1, "instruction": "Write Newton's Law of Cooling as a differential equation: dT/dt = −k(T − Tₐ). Identify all variables.", "hint": "Tₐ = 20°C is the ambient temperature."},
            {"step": 2, "instruction": "Solve the ODE by separation of variables. Apply the initial condition T(0) = 90 to find C.", "hint": "Integrate both sides; ln|T − Tₐ| = −kt + C."},
            {"step": 3, "instruction": "Use the condition T(10) = 70 to solve for k. Show all working.", "hint": "50 = 70·e^(−10k) — solve for k."},
            {"step": 4, "instruction": "Find when T = 60°C. Interpret your answer. Also, find the long-run temperature as t → ∞ and explain why that makes physical sense.", "hint": "Solve e^(−kt) = 40/70 for t."},
        ],
        "rubric_json": [
            {"criterion": "ODE formulation", "weight": 20, "description": "Correct differential equation and variable identification"},
            {"criterion": "General solution", "weight": 30, "description": "Correct separation and integration with initial condition"},
            {"criterion": "k determination", "weight": 25, "description": "Correct use of second condition"},
            {"criterion": "Prediction + long-run", "weight": 25, "description": "Correct time and physical interpretation"},
        ],
        "starter_context": "Newton's Law of Cooling — first-order linear ODE solved by separation of variables.",
    },
    {
        "title": "SIR Epidemic Model",
        "subject": "differential_equations",
        "level": "university",
        "description": "Analyse the classic SIR model for disease spread: dS/dt = −βSI/N, dI/dt = βSI/N − γI, dR/dt = γI. Determine the epidemic threshold, herd immunity, and peak infections analytically.",
        "difficulty": 5,
        "estimated_hours": 3.0,
        "tags": ["systems-of-ODEs", "epidemiology", "modelling"],
        "steps_json": [
            {"step": 1, "instruction": "Define the basic reproduction number R₀ = β/γ. Explain what happens when R₀ > 1 vs. R₀ < 1 by analysing dI/dt at t = 0.", "hint": "Factor dI/dt = I(βS/N − γ). At t=0, S≈N."},
            {"step": 2, "instruction": "Find the herd immunity threshold: the fraction of the population that must be immune to prevent an epidemic. Express in terms of R₀.", "hint": "The epidemic stops when S/N < 1/R₀."},
            {"step": 3, "instruction": "By dividing dI/dt by dS/dt, separate the variables and integrate to find I as a function of S. This is the phase-plane trajectory.", "hint": "dI/dS = −1 + γN/(βS). Integrate analytically."},
            {"step": 4, "instruction": "For COVID-19 estimates (R₀ ≈ 2.5, γ = 1/14 days⁻¹, N = 1,000,000, I₀ = 100): estimate the peak number of infected. Justify whether vaccination to 60% of N prevents an epidemic.", "hint": "Use your herd immunity formula: threshold = 1 − 1/R₀ = 1 − 1/2.5 = 60%."},
        ],
        "rubric_json": [
            {"criterion": "R₀ analysis", "weight": 20, "description": "Correct threshold condition from dI/dt"},
            {"criterion": "Herd immunity threshold", "weight": 25, "description": "Correct formula 1 − 1/R₀ with derivation"},
            {"criterion": "Phase-plane trajectory", "weight": 30, "description": "Correct ODE division, separation and integration"},
            {"criterion": "COVID application", "weight": 25, "description": "Correct numerical calculation and vaccination conclusion"},
        ],
        "starter_context": "SIR compartmental model — system of ODEs for susceptible, infected, and recovered populations. R₀ = β/γ determines epidemic dynamics.",
    },
    {
        "title": "Radioactive Decay Chain",
        "subject": "differential_equations",
        "level": "university",
        "description": "Uranium-238 decays to Thorium-234 (λ₁), which decays to Protactinium-234 (λ₂). Model the two-step decay chain, solve the coupled ODEs, and find when Thorium-234 peaks.",
        "difficulty": 4,
        "estimated_hours": 2.0,
        "tags": ["systems-of-ODEs", "nuclear-physics", "coupled-equations"],
        "steps_json": [
            {"step": 1, "instruction": "Write the coupled system: dU/dt = −λ₁U, dTh/dt = λ₁U − λ₂Th, dPa/dt = λ₂Th. Identify which ODE can be solved independently first.", "hint": "The U equation is independent and separable."},
            {"step": 2, "instruction": "Solve for U(t) = U₀e^(−λ₁t). Substitute into the Thorium ODE and solve the resulting first-order linear ODE using an integrating factor.", "hint": "Integrating factor: μ = e^(λ₂t)"},
            {"step": 3, "instruction": "Set λ₁ = 4.87 × 10⁻¹⁸ s⁻¹ (U-238 half-life ≈ 4.5 × 10⁹ years) and λ₂ = 3.0 × 10⁻⁶ s⁻¹ (Th-234, 24-day half-life). With Th(0) = 0, simplify Th(t). Which term dominates?", "hint": "Since λ₁ ≪ λ₂, the e^(−λ₂t) term decays fast; the e^(−λ₁t) term is approximately constant."},
            {"step": 4, "instruction": "Find the time at which Th(t) is maximised by setting dTh/dt = 0. Verify using your formula from Step 2. What is the physical interpretation of this maximum?", "hint": "At the maximum, production = decay, i.e., λ₁U = λ₂Th."},
        ],
        "rubric_json": [
            {"criterion": "System formulation", "weight": 20, "description": "Correct coupled ODE system"},
            {"criterion": "U(t) and Th(t) solutions", "weight": 35, "description": "Correct integration factor method for Th(t)"},
            {"criterion": "Physical simplification", "weight": 20, "description": "Correct dominant term argument"},
            {"criterion": "Maximum time", "weight": 25, "description": "Correct dTh/dt=0 calculation and physical interpretation"},
        ],
        "starter_context": "Bateman equations for a two-step radioactive decay chain solved by integrating factor method.",
    },
]
