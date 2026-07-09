"""
Real Data Mathematics — multi-source live data proxy, descriptive stats, regression, AI analysis.
Sources:
  • World Bank Open Data  (no API key)
  • FRED — Federal Reserve  (requires FRED_API_KEY env var)
  • Open-Meteo Climate  (no API key)
  • NASA POWER            (no API key — satellite-derived meteorology & solar data)
"""
import json
import logging
import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.models.user import User
from app.routers.auth import get_current_user

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/math/data", tags=["data"])

# ── Catalogs ──────────────────────────────────────────────────────────────────

WORLD_BANK_INDICATORS = [
    {"id": "NY.GDP.MKTP.CD",    "name": "GDP (Current USD)",             "unit": "Trillion USD",   "scale": 1e12},
    {"id": "SP.POP.TOTL",       "name": "Total Population",              "unit": "Million people", "scale": 1e6},
    {"id": "EN.ATM.CO2E.PC",    "name": "CO₂ Emissions per Capita",      "unit": "Metric tons",    "scale": 1},
    {"id": "SL.UEM.TOTL.ZS",    "name": "Unemployment Rate",             "unit": "%",              "scale": 1},
    {"id": "FP.CPI.TOTL.ZG",    "name": "Inflation Rate (CPI)",          "unit": "%",              "scale": 1},
    {"id": "SE.XPD.TOTL.GD.ZS", "name": "Education Expenditure % GDP",   "unit": "%",              "scale": 1},
    {"id": "SP.DYN.LE00.IN",    "name": "Life Expectancy at Birth",      "unit": "Years",          "scale": 1},
    {"id": "AG.LND.FRST.ZS",    "name": "Forest Area (% of land area)",  "unit": "%",              "scale": 1},
    {"id": "EG.USE.PCAP.KG.OE", "name": "Energy Use per Capita",         "unit": "kg oil equiv",  "scale": 1},
    {"id": "IT.NET.USER.ZS",    "name": "Internet Users (% population)", "unit": "%",              "scale": 1},
]

COUNTRIES = [
    {"code": "US", "name": "United States"}, {"code": "CN", "name": "China"},
    {"code": "DE", "name": "Germany"},       {"code": "JP", "name": "Japan"},
    {"code": "GB", "name": "United Kingdom"},{"code": "FR", "name": "France"},
    {"code": "IN", "name": "India"},         {"code": "BR", "name": "Brazil"},
    {"code": "CA", "name": "Canada"},        {"code": "AU", "name": "Australia"},
    {"code": "KR", "name": "South Korea"},   {"code": "MX", "name": "Mexico"},
    {"code": "ZA", "name": "South Africa"},  {"code": "NG", "name": "Nigeria"},
    {"code": "EG", "name": "Egypt"},         {"code": "SE", "name": "Sweden"},
    {"code": "SG", "name": "Singapore"},     {"code": "NL", "name": "Netherlands"},
]

# ── IMF DataMapper (replaces FRED — free, no key, global) ────────────────────
# https://www.imf.org/external/datamapper/api/v1/{indicator}/{country}

IMF_INDICATORS = [
    {"id": "NGDP_RPCH",    "name": "Real GDP Growth Rate",          "unit": "%"},
    {"id": "NGDPD",        "name": "GDP (Nominal, USD Billions)",   "unit": "Billion USD"},
    {"id": "PCPIPCH",      "name": "Inflation Rate (CPI)",          "unit": "%"},
    {"id": "LUR",          "name": "Unemployment Rate",             "unit": "%"},
    {"id": "BCA_NGDPD",    "name": "Current Account Balance",       "unit": "% of GDP"},
    {"id": "GGXWDG_NGDP",  "name": "Government Gross Debt",         "unit": "% of GDP"},
    {"id": "NID_NGDP",     "name": "Total Investment",              "unit": "% of GDP"},
    {"id": "PPPGDP",       "name": "GDP (PPP, Intl. Dollars)",      "unit": "Billion Int'l $"},
    {"id": "GGXCNL_NGDP",  "name": "Fiscal Balance",               "unit": "% of GDP"},
    {"id": "TM_RPCH",      "name": "Import Volume Growth",          "unit": "%"},
]

# IMF uses ISO alpha-3 country codes
IMF_COUNTRIES = [
    {"code": "USA", "name": "United States"},
    {"code": "CHN", "name": "China"},
    {"code": "DEU", "name": "Germany"},
    {"code": "JPN", "name": "Japan"},
    {"code": "GBR", "name": "United Kingdom"},
    {"code": "FRA", "name": "France"},
    {"code": "IND", "name": "India"},
    {"code": "BRA", "name": "Brazil"},
    {"code": "CAN", "name": "Canada"},
    {"code": "AUS", "name": "Australia"},
    {"code": "KOR", "name": "South Korea"},
    {"code": "MEX", "name": "Mexico"},
    {"code": "ZAF", "name": "South Africa"},
    {"code": "NGA", "name": "Nigeria"},
    {"code": "EGY", "name": "Egypt"},
    {"code": "SWE", "name": "Sweden"},
    {"code": "SGP", "name": "Singapore"},
    {"code": "NLD", "name": "Netherlands"},
    {"code": "SAU", "name": "Saudi Arabia"},
    {"code": "ARG", "name": "Argentina"},
]

CLIMATE_VARIABLES = [
    {"id": "temperature_2m_mean", "name": "Mean Daily Temperature", "unit": "°C"},
    {"id": "precipitation_sum",   "name": "Annual Precipitation",    "unit": "mm"},
    {"id": "wind_speed_10m_max",  "name": "Max Wind Speed",          "unit": "km/h"},
]

CITIES = [
    {"id": "new_york",  "name": "New York",   "lat": 40.71,  "lon": -74.01},
    {"id": "london",    "name": "London",     "lat": 51.51,  "lon": -0.13},
    {"id": "tokyo",     "name": "Tokyo",      "lat": 35.68,  "lon": 139.69},
    {"id": "paris",     "name": "Paris",      "lat": 48.86,  "lon": 2.35},
    {"id": "sydney",    "name": "Sydney",     "lat": -33.87, "lon": 151.21},
    {"id": "dubai",     "name": "Dubai",      "lat": 25.20,  "lon": 55.27},
    {"id": "nairobi",   "name": "Nairobi",    "lat": -1.29,  "lon": 36.82},
    {"id": "sao_paulo", "name": "São Paulo",  "lat": -23.55, "lon": -46.63},
    {"id": "delhi",     "name": "New Delhi",  "lat": 28.61,  "lon": 77.21},
    {"id": "beijing",   "name": "Beijing",    "lat": 39.91,  "lon": 116.39},
    {"id": "moscow",    "name": "Moscow",     "lat": 55.75,  "lon": 37.62},
    {"id": "cape_town", "name": "Cape Town",  "lat": -33.92, "lon": 18.42},
]

# ── NASA POWER ────────────────────────────────────────────────────────────────
# https://power.larc.nasa.gov/api/temporal/annual/point
# Each parameter must use its correct community or the API returns 400.
# AG = Agroclimatology (temperature, humidity, precip, wind 2m)
# RE = Renewable Energy (solar irradiance, wind 50m)

NASA_PARAMETERS = [
    {"id": "T2M",              "name": "Air Temperature (2m)",           "unit": "°C",         "community": "AG"},
    {"id": "T2M_MAX",          "name": "Max Temperature (2m)",           "unit": "°C",         "community": "AG"},
    {"id": "T2M_MIN",          "name": "Min Temperature (2m)",           "unit": "°C",         "community": "AG"},
    {"id": "PRECTOTCORR",      "name": "Precipitation (Corrected)",      "unit": "mm/day",     "community": "AG"},
    {"id": "RH2M",             "name": "Relative Humidity (2m)",         "unit": "%",          "community": "AG"},
    {"id": "WS2M",             "name": "Wind Speed (2m)",                "unit": "m/s",        "community": "AG"},
    {"id": "ALLSKY_SFC_SW_DWN","name": "Solar Irradiance (Surface)",     "unit": "kWh/m²/day", "community": "RE"},
    {"id": "WS50M",            "name": "Wind Speed (50m) — Wind Energy", "unit": "m/s",        "community": "RE"},
]

# NASA POWER uses the same city lat/lon list as Open-Meteo (CITIES above)

# ── WHO Global Health Observatory ─────────────────────────────────────────────
# https://ghoapi.azureedge.net/api/{indicator}?$filter=SpatialDim eq '{code}'
# OData API — no key required, ISO-3166 alpha-3 country codes.

WHO_INDICATORS = [
    {"id": "WHOSIS_000001",      "name": "Life Expectancy at Birth",         "unit": "Years"},
    {"id": "WHOSIS_000015",      "name": "Healthy Life Expectancy (HALE)",   "unit": "Years"},
    {"id": "MDG_0000000001",     "name": "Under-Five Mortality Rate",        "unit": "Per 1,000 live births"},
    {"id": "NUTRITION_OVERWEIGHT","name": "Overweight Adults (BMI ≥ 25)",    "unit": "%"},
    {"id": "NCD_BMI_30A",        "name": "Obesity Prevalence (BMI ≥ 30)",    "unit": "%"},
    {"id": "SA_0000001688",      "name": "Alcohol Consumption per Capita",   "unit": "Litres pure alcohol"},
    {"id": "MALARIA_EST_INCIDENCE","name": "Malaria Incidence",              "unit": "Per 1,000 at risk"},
    {"id": "HIV_0000000001",     "name": "HIV Prevalence (adults 15–49)",    "unit": "%"},
    {"id": "WHS6_102",           "name": "Physicians Density",               "unit": "Per 10,000 population"},
    {"id": "TOBACCO_0000000192", "name": "Tobacco Use (age-standardised)",   "unit": "%"},
]

# WHO uses ISO alpha-3 codes (not alpha-2)
WHO_COUNTRIES = [
    {"code": "USA", "name": "United States"},
    {"code": "CHN", "name": "China"},
    {"code": "DEU", "name": "Germany"},
    {"code": "JPN", "name": "Japan"},
    {"code": "GBR", "name": "United Kingdom"},
    {"code": "FRA", "name": "France"},
    {"code": "IND", "name": "India"},
    {"code": "BRA", "name": "Brazil"},
    {"code": "CAN", "name": "Canada"},
    {"code": "AUS", "name": "Australia"},
    {"code": "KOR", "name": "South Korea"},
    {"code": "MEX", "name": "Mexico"},
    {"code": "ZAF", "name": "South Africa"},
    {"code": "NGA", "name": "Nigeria"},
    {"code": "EGY", "name": "Egypt"},
    {"code": "SWE", "name": "Sweden"},
    {"code": "SGP", "name": "Singapore"},
    {"code": "NLD", "name": "Netherlands"},
    {"code": "ETH", "name": "Ethiopia"},
    {"code": "PAK", "name": "Pakistan"},
]

# ── Pure-Python stats & regression ────────────────────────────────────────────

def _stats(values: List[float]) -> Dict[str, float]:
    n = len(values)
    if n == 0:
        return {}
    mean = sum(values) / n
    sv = sorted(values)
    mid = n // 2
    median = sv[mid] if n % 2 else (sv[mid - 1] + sv[mid]) / 2
    variance = sum((x - mean) ** 2 for x in values) / max(n - 1, 1)
    return {
        "count":  float(n),
        "mean":   round(mean, 4),
        "median": round(median, 4),
        "std":    round(math.sqrt(variance), 4),
        "min":    round(min(values), 4),
        "max":    round(max(values), 4),
    }


def _regression(x: List[float], y: List[float]) -> Dict[str, float]:
    n = len(x)
    if n < 2:
        return {"slope": 0.0, "intercept": 0.0, "r_squared": 0.0}
    xm = sum(x) / n
    ym = sum(y) / n
    num = sum((xi - xm) * (yi - ym) for xi, yi in zip(x, y))
    den = sum((xi - xm) ** 2 for xi in x)
    slope = num / den if den else 0.0
    intercept = ym - slope * xm
    y_hat = [slope * xi + intercept for xi in x]
    ss_res = sum((yi - yhi) ** 2 for yi, yhi in zip(y, y_hat))
    ss_tot = sum((yi - ym) ** 2 for yi in y)
    r2 = 1.0 - ss_res / ss_tot if ss_tot else 1.0
    return {
        "slope":     round(slope, 6),
        "intercept": round(intercept, 4),
        "r_squared": round(max(0.0, r2), 4),
    }

# ── Schemas ───────────────────────────────────────────────────────────────────

class DataPoint(BaseModel):
    label: str
    value: float


class FetchRequest(BaseModel):
    source: str = "world_bank"   # "world_bank" | "fred" | "open_meteo"
    indicator: str               # indicator/series/variable id
    country: str = "US"          # world_bank: ISO-2 country code
    city: str = "new_york"       # open_meteo: city id
    years: int = 20


class FetchResponse(BaseModel):
    source: str
    indicator: str
    indicator_name: str
    location: str                # country name or city name
    unit: str
    data: List[DataPoint]
    stats: Dict[str, float]
    regression: Dict[str, float]


class AnalyzeRequest(BaseModel):
    source: str = "world_bank"
    indicator_name: str
    location: str
    unit: str
    data: List[DataPoint]
    question: str
    subject: str = "statistics"
    level: str = "high_school"
    model_name: str = "gpt-4o"


class AnalyzeResponse(BaseModel):
    analysis: str
    math_connection: str
    key_insight: str

# ── Fetchers ──────────────────────────────────────────────────────────────────

async def _fetch_world_bank(indicator: str, country: str, years: int) -> List[DataPoint]:
    meta = next((i for i in WORLD_BANK_INDICATORS if i["id"] == indicator), None)
    if not meta:
        raise HTTPException(400, f"Unknown World Bank indicator: {indicator}")
    url = (
        f"https://api.worldbank.org/v2/country/{country}"
        f"/indicator/{indicator}"
        f"?format=json&per_page={years}&mrv={years}"
    )
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
    payload = r.json()
    if not isinstance(payload, list) or len(payload) < 2:
        raise HTTPException(502, "Unexpected World Bank response format.")
    records = payload[1] or []
    scale = meta["scale"]
    points = []
    for rec in records:
        if rec.get("value") is not None:
            points.append(DataPoint(label=str(rec["date"]), value=round(rec["value"] / scale, 4)))
    points.sort(key=lambda p: p.label)
    return points


async def _fetch_imf(indicator: str, country_code: str, years: int) -> List[DataPoint]:
    """Fetch annual data from IMF DataMapper API (no key required, global coverage)."""
    ind_meta = next((i for i in IMF_INDICATORS if i["id"] == indicator), None)
    if not ind_meta:
        raise HTTPException(400, f"Unknown IMF indicator: {indicator}")
    country = next((c for c in IMF_COUNTRIES if c["code"] == country_code), None)
    if not country:
        raise HTTPException(400, f"Unknown IMF country: {country_code}")

    url = f"https://www.imf.org/external/datamapper/api/v1/{indicator}/{country_code}"
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code in (400, 404):
            raise HTTPException(400, f"IMF: indicator '{indicator}' not available for {country_code}.")
        r.raise_for_status()

    raw = r.json()
    values_dict: Dict[str, float] = (
        raw.get("values", {})
           .get(indicator, {})
           .get(country_code, {})
    )
    if not values_dict:
        raise HTTPException(404, f"No IMF data found for {indicator} / {country_code}.")

    cutoff = date.today().year - min(years, 40)
    points = []
    for yr in sorted(values_dict):
        try:
            y = int(yr)
            v = float(values_dict[yr])
        except (ValueError, TypeError):
            continue
        if y >= cutoff and not math.isnan(v) and not math.isinf(v):
            points.append(DataPoint(label=str(yr), value=round(v, 4)))
    return points


async def _fetch_open_meteo(variable: str, city_id: str, years: int) -> List[DataPoint]:
    city = next((c for c in CITIES if c["id"] == city_id), None)
    if not city:
        raise HTTPException(400, f"Unknown city: {city_id}")
    var_meta = next((v for v in CLIMATE_VARIABLES if v["id"] == variable), None)
    if not var_meta:
        raise HTTPException(400, f"Unknown climate variable: {variable}")

    today = date.today()
    end_date = today.replace(year=today.year - 1, month=12, day=31)
    start_date = end_date.replace(year=end_date.year - min(years, 30) + 1, month=1, day=1)

    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={city['lat']}&longitude={city['lon']}"
        f"&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
        f"&daily={variable}&timezone=UTC"
    )
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
    payload = r.json()
    times = payload.get("daily", {}).get("time", [])
    vals = payload.get("daily", {}).get(variable, [])

    # Aggregate daily → annual averages
    annual: Dict[str, List[float]] = defaultdict(list)
    for t, v in zip(times, vals):
        if v is not None:
            annual[t[:4]].append(v)

    points = []
    for yr in sorted(annual):
        if annual[yr]:
            agg = sum(annual[yr]) / len(annual[yr])
            points.append(DataPoint(label=yr, value=round(agg, 4)))
    return points

async def _fetch_nasa_power(parameter: str, city_id: str, years: int) -> List[DataPoint]:
    """
    Fetch from NASA POWER *monthly* endpoint and aggregate to annual averages.
    Monthly endpoint has much broader parameter coverage than the annual one.
    Monthly keys are YYYYMM; we group by YYYY and average. Fill value is -999.
    """
    city = next((c for c in CITIES if c["id"] == city_id), None)
    if not city:
        raise HTTPException(400, f"Unknown city: {city_id}")
    param_meta = next((p for p in NASA_PARAMETERS if p["id"] == parameter), None)
    if not param_meta:
        raise HTTPException(400, f"Unknown NASA parameter: {parameter}")

    end_year   = date.today().year - 1
    start_year = max(end_year - min(years, 40) + 1, 1981)
    community  = param_meta.get("community", "AG")

    url = (
        f"https://power.larc.nasa.gov/api/temporal/monthly/point"
        f"?parameters={parameter}&community={community}"
        f"&longitude={city['lon']}&latitude={city['lat']}"
        f"&start={start_year}&end={end_year}&format=JSON"
    )
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code in (400, 404):
            detail = ""
            try:
                detail = r.json().get("message", "")
            except Exception:
                pass
            raise HTTPException(400, f"NASA POWER: '{parameter}' unavailable for this location. {detail}".strip())
        r.raise_for_status()

    payload = r.json()
    monthly: Dict[str, float] = (
        payload.get("properties", {})
               .get("parameter", {})
               .get(parameter, {})
    )

    # Keys are YYYYMM — group by year, skip -999 fill values
    annual: Dict[str, List[float]] = defaultdict(list)
    for key, v in monthly.items():
        if len(key) >= 4 and v is not None:
            try:
                fv = float(v)
            except (ValueError, TypeError):
                continue
            if fv > -900:  # NASA fill value is -999
                annual[key[:4]].append(fv)

    points = []
    for yr in sorted(annual):
        if annual[yr]:
            avg = sum(annual[yr]) / len(annual[yr])
            points.append(DataPoint(label=yr, value=round(avg, 4)))
    return points


async def _fetch_who(indicator: str, who_code: str, years: int) -> List[DataPoint]:
    """Fetch annual data from the WHO GHO OData API (no key required)."""
    ind_meta = next((i for i in WHO_INDICATORS if i["id"] == indicator), None)
    if not ind_meta:
        raise HTTPException(400, f"Unknown WHO indicator: {indicator}")
    country = next((c for c in WHO_COUNTRIES if c["code"] == who_code), None)
    if not country:
        raise HTTPException(400, f"Unknown WHO country code: {who_code}")

    start_year = date.today().year - min(years, 30)
    # OData filter: country + year-based time dimension + start year
    filter_q = (
        f"SpatialDim eq '{who_code}' and TimeDimType eq 'YEAR' "
        f"and TimeDim ge {start_year}"
    )
    url = (
        f"https://ghoapi.azureedge.net/api/{indicator}"
        f"?$filter={filter_q}"
        f"&$select=TimeDim,NumericValue,Dim1"
        f"&$orderby=TimeDim asc"
        f"&$top=500"
    )
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code == 404:
            raise HTTPException(400, f"WHO: indicator '{indicator}' not found.")
        r.raise_for_status()

    rows = r.json().get("value", [])

    # Aggregate per year: prefer BTSX (both sexes) rows; fall back to null Dim1; then average all
    annual: Dict[int, List[float]] = defaultdict(list)
    btsx: Dict[int, float] = {}

    for row in rows:
        yr = row.get("TimeDim")
        val = row.get("NumericValue")
        dim1 = row.get("Dim1")
        if yr is None or val is None:
            continue
        try:
            yr = int(yr)
            val = float(val)
        except (ValueError, TypeError):
            continue
        if dim1 == "BTSX":
            btsx[yr] = val   # authoritative aggregate
        elif dim1 is None:
            annual[yr].append(val)
        else:
            annual[yr].append(val)  # include sub-group as fallback

    # Build final series: prefer BTSX, then mean of available values
    all_years = sorted(set(list(btsx.keys()) + list(annual.keys())))
    points = []
    for yr in all_years:
        if yr in btsx:
            v = btsx[yr]
        elif annual[yr]:
            v = sum(annual[yr]) / len(annual[yr])
        else:
            continue
        points.append(DataPoint(label=str(yr), value=round(v, 4)))

    return points


# ── AI dispatch ───────────────────────────────────────────────────────────────

ANTHROPIC_MODEL_MAP = {
    "claude-sonnet-4":   "claude-sonnet-4-6",
    "claude-haiku-4":    "claude-haiku-4-5-20251001",
    "claude-opus-4":     "claude-opus-4-8",
    "claude-3-5-sonnet": "claude-sonnet-4-6",
}


async def _ai_analyze(prompt: str, model: str) -> str:
    if model.startswith("claude"):
        try:
            import anthropic as anthropic_sdk
        except ImportError:
            raise HTTPException(500, "Anthropic SDK not installed.")
        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
            raise HTTPException(500, "Anthropic API key not configured.")
        api_model = ANTHROPIC_MODEL_MAP.get(model, "claude-sonnet-4-6")
        client = anthropic_sdk.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
        resp = await client.messages.create(
            model=api_model, max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text if resp.content else "{}"
    # OpenAI
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise HTTPException(500, "OpenAI SDK not installed.")
    if not getattr(settings, "OPENAI_API_KEY", ""):
        raise HTTPException(500, "OpenAI API key not configured.")
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0)
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=600,
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    return resp.choices[0].message.content or "{}"

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/catalog")
async def catalog(_: User = Depends(get_current_user)):
    """Return all available data sources with their indicators/dimensions."""
    return {
        "sources": [
            {
                "id":          "world_bank",
                "name":        "World Bank Open Data",
                "description": "Economic & demographic indicators for 200+ countries (1960–present)",
                "available":   True,
                "requires_key": False,
                "indicators":  WORLD_BANK_INDICATORS,
                "countries":   COUNTRIES,
            },
            {
                "id":          "imf",
                "name":        "IMF Data",
                "description": "IMF macroeconomic indicators for 190+ countries — GDP, inflation, debt, trade (1980–present)",
                "available":   True,
                "requires_key": False,
                "indicators":  IMF_INDICATORS,
                "countries":   IMF_COUNTRIES,
            },
            {
                "id":          "open_meteo",
                "name":        "Open-Meteo Climate",
                "description": "Historical daily weather & climate for major cities (1940–present)",
                "available":   True,
                "requires_key": False,
                "indicators":  CLIMATE_VARIABLES,
                "cities":      CITIES,
            },
            {
                "id":          "nasa_power",
                "name":        "NASA POWER",
                "description": "NASA satellite-derived meteorology & solar energy data for any location (1981–present)",
                "available":   True,
                "requires_key": False,
                "indicators":  NASA_PARAMETERS,
                "cities":      CITIES,
            },
            {
                "id":          "who",
                "name":        "WHO Global Health",
                "description": "WHO Global Health Observatory — health & disease indicators for 190+ countries",
                "available":   True,
                "requires_key": False,
                "indicators":  WHO_INDICATORS,
                "countries":   WHO_COUNTRIES,
            },
        ]
    }


@router.post("/fetch", response_model=FetchResponse)
async def fetch_data(
    req: FetchRequest,
    _: User = Depends(get_current_user),
):
    """Fetch live data from the selected source; return data + stats + regression."""
    try:
        if req.source == "world_bank":
            meta = next((i for i in WORLD_BANK_INDICATORS if i["id"] == req.indicator), None)
            if not meta:
                raise HTTPException(400, f"Unknown indicator: {req.indicator}")
            country_name = next((c["name"] for c in COUNTRIES if c["code"] == req.country), req.country)
            points = await _fetch_world_bank(req.indicator, req.country, req.years)
            indicator_name = meta["name"]
            unit = meta["unit"]
            location = country_name

        elif req.source == "imf":
            ind_meta = next((i for i in IMF_INDICATORS if i["id"] == req.indicator), None)
            if not ind_meta:
                raise HTTPException(400, f"Unknown IMF indicator: {req.indicator}")
            imf_country = next((c for c in IMF_COUNTRIES if c["code"] == req.country), None)
            if not imf_country:
                raise HTTPException(400, f"Unknown IMF country: {req.country}")
            points = await _fetch_imf(req.indicator, req.country, req.years)
            indicator_name = ind_meta["name"]
            unit = ind_meta["unit"]
            location = imf_country["name"]

        elif req.source == "open_meteo":
            var_meta = next((v for v in CLIMATE_VARIABLES if v["id"] == req.indicator), None)
            if not var_meta:
                raise HTTPException(400, f"Unknown climate variable: {req.indicator}")
            city = next((c for c in CITIES if c["id"] == req.city), None)
            if not city:
                raise HTTPException(400, f"Unknown city: {req.city}")
            points = await _fetch_open_meteo(req.indicator, req.city, req.years)
            indicator_name = var_meta["name"]
            unit = var_meta["unit"]
            location = city["name"]

        elif req.source == "nasa_power":
            param_meta = next((p for p in NASA_PARAMETERS if p["id"] == req.indicator), None)
            if not param_meta:
                raise HTTPException(400, f"Unknown NASA parameter: {req.indicator}")
            city = next((c for c in CITIES if c["id"] == req.city), None)
            if not city:
                raise HTTPException(400, f"Unknown city: {req.city}")
            points = await _fetch_nasa_power(req.indicator, req.city, req.years)
            indicator_name = param_meta["name"]
            unit = param_meta["unit"]
            location = city["name"]

        elif req.source == "who":
            ind_meta = next((i for i in WHO_INDICATORS if i["id"] == req.indicator), None)
            if not ind_meta:
                raise HTTPException(400, f"Unknown WHO indicator: {req.indicator}")
            who_country = next((c for c in WHO_COUNTRIES if c["code"] == req.country), None)
            if not who_country:
                raise HTTPException(400, f"Unknown WHO country: {req.country}")
            points = await _fetch_who(req.indicator, req.country, req.years)
            indicator_name = ind_meta["name"]
            unit = ind_meta["unit"]
            location = who_country["name"]

        else:
            raise HTTPException(400, f"Unknown source: {req.source}")

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"External API error {e.response.status_code}")
    except Exception as e:
        logger.error(f"[data/fetch] {e}", exc_info=True)
        raise HTTPException(502, f"Data fetch failed: {str(e)[:200]}")

    if not points:
        raise HTTPException(404, "No data returned — try a different indicator, country, or date range.")

    values = [p.value for p in points]
    return FetchResponse(
        source=req.source,
        indicator=req.indicator,
        indicator_name=indicator_name,
        location=location,
        unit=unit,
        data=points,
        stats=_stats(values),
        regression=_regression(list(range(len(values))), values),
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_data(
    req: AnalyzeRequest,
    _: User = Depends(get_current_user),
):
    """AI mathematical analysis of a fetched real-world dataset."""
    data_str = "; ".join(f"{p.label}: {p.value}" for p in req.data[-12:])
    source_labels = {
        "world_bank": "World Bank",
        "imf":        "IMF (International Monetary Fund)",
        "open_meteo": "Open-Meteo Climate",
        "nasa_power": "NASA POWER (satellite data)",
        "who":        "WHO Global Health Observatory",
    }

    prompt = f"""You are a mathematics educator explaining real-world data to a {req.level.replace('_', ' ')} student studying {req.subject.replace('_', ' ')}.

Data source: {source_labels.get(req.source, req.source)}
Dataset: {req.indicator_name} — {req.location}
Unit: {req.unit}
Data (most recent 12 annual values): {data_str}
Student question: {req.question}

Respond with a JSON object with exactly these three string keys:
- "analysis": 2-3 sentences directly answering the question using actual data values and numbers
- "math_connection": 1-2 sentences connecting this data to mathematical concepts (trend, slope, rate of change, mean, std, correlation, etc.)
- "key_insight": one memorable mathematical "aha moment" from this dataset — something surprising or elegant

Be specific with numbers. Make the math tangible and real."""

    try:
        raw = await _ai_analyze(prompt, req.model_name)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[data/analyze] {e}", exc_info=True)
        raise HTTPException(500, f"AI analysis failed: {str(e)[:200]}")

    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) > 1 else text

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "AI returned malformed JSON — please retry.")

    return AnalyzeResponse(
        analysis=result.get("analysis", ""),
        math_connection=result.get("math_connection", ""),
        key_insight=result.get("key_insight", ""),
    )
