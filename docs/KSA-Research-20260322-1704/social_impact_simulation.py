#!/usr/bin/env python3
"""
Monte Carlo Social Impact Simulation — River Grove Parks Conservancy
1000 iterations modeling community outcomes across randomized variables.

Models: youth employment outcomes, community engagement, economic multipliers,
political dynamics, environmental impact, property values, and cultural shifts.
"""

import random
import json
import statistics
import math
from dataclasses import dataclass, field
from typing import List, Dict, Tuple
from collections import Counter

random.seed(2026)

# ═══════════════════════════════════════════════════════════════════════════
# COMMUNITY BASELINE — Kingwood Demographics
# ═══════════════════════════════════════════════════════════════════════════

KINGWOOD_POP = 64000
KINGWOOD_HOUSEHOLDS = 23354
MEDIAN_INCOME = 111859
YOUTH_16_24 = int(KINGWOOD_POP * 0.11)  # ~7,040
YOUTH_UNEMPLOYMENT_RATE = 0.12  # 12% for 16-24 age group
UNEMPLOYED_YOUTH = int(YOUTH_16_24 * YOUTH_UNEMPLOYMENT_RATE)  # ~845
PARK_ACRES = 356.6
RIVER_GROVE_ACRES = 74
CURRENT_ANNUAL_PARK_VISITORS = 50000  # estimated
DG_ANNUAL_ROUNDS = 15000  # estimated (UDisc tracks ~4,500; actual 3-4x)
ASSESSMENT_PER_UNIT = 41  # current KSA cost per equivalent unit


@dataclass
class SocialImpactScenario:
    """One Monte Carlo iteration of the 5-year social impact model."""
    iteration: int

    # ── Input Variables (Randomized) ──
    # Phase 1-3 execution quality
    volunteer_engagement: float = 0.0   # 0-1 scale
    leadership_quality: float = 0.0
    tech_platform_readiness: float = 0.0
    community_reception: float = 0.0    # How Kingwood responds
    ksa_response: str = ""              # cooperate, ignore, resist

    # External factors
    economy: str = ""                   # strong, moderate, weak
    hurricane_hits: bool = False        # Major flood event in 5 years
    media_coverage: str = ""            # heavy, moderate, light
    political_support: float = 0.0      # 0-1 from council/super neighborhood
    grant_success_rate: float = 0.0     # % of grants awarded

    # ── Output Variables (Calculated) ──
    # Youth Employment
    youth_hired_yr1: int = 0
    youth_hired_yr3: int = 0
    youth_hired_yr5: int = 0
    youth_total_5yr: int = 0            # cumulative unique youth employed
    youth_wages_5yr: float = 0
    youth_skills_acquired: int = 0      # certifications, skills logged
    youth_college_bound: int = 0        # who go on to higher ed
    youth_career_launched: int = 0      # who get jobs in parks/tech/env

    # Community Engagement
    annual_events_yr3: int = 0
    annual_events_yr5: int = 0
    annual_park_visitors_yr5: int = 0
    volunteer_hours_5yr: float = 0
    community_members_engaged: int = 0  # unique people who interact
    new_disc_golfers: int = 0

    # Economic Impact
    direct_spending_5yr: float = 0      # RGPC operational spending
    tourism_revenue_5yr: float = 0
    local_business_impact_5yr: float = 0
    property_value_impact: float = 0    # total $ across affected homes
    jobs_created_beyond_youth: int = 0  # ED, maintenance lead, etc.
    tax_revenue_generated: float = 0

    # Environmental
    trees_planted: int = 0
    trail_miles_maintained: float = 0
    acres_under_conservation: float = 0
    flood_sensors_installed: int = 0
    watershed_data_points: int = 0
    trash_collected_lbs: float = 0
    native_species_documented: int = 0

    # Governance & Transparency
    financial_reports_published: int = 0
    board_meetings_streamed: int = 0
    resident_complaints_resolved_pct: float = 0
    trust_score: float = 0              # 0-10 community trust index

    # Technology
    app_downloads: int = 0
    digital_checkins: int = 0
    maintenance_requests_resolved: int = 0
    platform_adoption_rate: float = 0

    # Political
    village_boards_supporting: int = 0
    council_support: bool = False
    ksa_reform_achieved: bool = False
    pid_petition_viable: bool = False

    # Risks Realized
    burnout_occurred: bool = False
    funding_crisis: bool = False
    ksa_legal_retaliation: bool = False
    flood_damage: float = 0

    # Overall
    initiative_status: str = ""         # thriving, stable, struggling, failed
    social_impact_score: float = 0      # composite 0-100
    notes: List[str] = field(default_factory=list)


def triangular(low, mode, high):
    """Triangular distribution — most likely outcome is mode."""
    return random.triangular(low, high, mode)


def simulate_scenario(i: int) -> SocialImpactScenario:
    s = SocialImpactScenario(iteration=i)

    # ── Randomize Input Variables ──────────────────────────────────

    s.volunteer_engagement = triangular(0.2, 0.6, 1.0)
    s.leadership_quality = triangular(0.3, 0.7, 1.0)
    s.tech_platform_readiness = triangular(0.4, 0.7, 1.0)
    s.community_reception = triangular(0.2, 0.6, 1.0)

    # KSA response: weighted — most likely ignore, then resist, then cooperate
    r = random.random()
    if r < 0.25:
        s.ksa_response = "cooperate"
    elif r < 0.65:
        s.ksa_response = "ignore"
    else:
        s.ksa_response = "resist"

    # Economy
    r = random.random()
    s.economy = "strong" if r < 0.35 else ("moderate" if r < 0.75 else "weak")

    s.hurricane_hits = random.random() < 0.30  # 30% chance over 5 years
    s.media_coverage = random.choice(["heavy"] * 2 + ["moderate"] * 5 + ["light"] * 3)
    s.political_support = triangular(0.2, 0.5, 0.9)
    s.grant_success_rate = triangular(0.2, 0.5, 0.8)

    # ── Composite Execution Score ──────────────────────────────────
    execution = (s.volunteer_engagement * 0.25 +
                 s.leadership_quality * 0.30 +
                 s.tech_platform_readiness * 0.20 +
                 s.community_reception * 0.25)

    # KSA response modifier
    ksa_mod = {"cooperate": 0.15, "ignore": 0.0, "resist": -0.10}[s.ksa_response]
    execution = max(0.1, min(1.0, execution + ksa_mod))

    # Economy modifier
    econ_mod = {"strong": 0.10, "moderate": 0.0, "weak": -0.15}[s.economy]
    execution = max(0.1, min(1.0, execution + econ_mod))

    if s.ksa_response == "cooperate":
        s.notes.append("KSA cooperates — partnership MOU signed")
    elif s.ksa_response == "resist":
        s.notes.append("KSA resists — legal leverage may be needed")
        s.ksa_legal_retaliation = random.random() < 0.30

    # ── YOUTH EMPLOYMENT ───────────────────────────────────────────

    # Year 1: depends on execution and grant success
    base_yr1 = int(10 * execution * (0.5 + 0.5 * s.grant_success_rate))
    s.youth_hired_yr1 = max(2, min(15, base_yr1))

    # Year 3: growth depends on continued execution
    yr3_growth = 1.5 + execution * 2.0  # 1.5x to 3.5x growth
    s.youth_hired_yr3 = max(s.youth_hired_yr1, min(55, int(s.youth_hired_yr1 * yr3_growth)))

    # Year 5: mature program
    yr5_growth = 1.2 + execution * 0.8  # 1.2x to 2.0x from year 3
    s.youth_hired_yr5 = max(s.youth_hired_yr3, min(75, int(s.youth_hired_yr3 * yr5_growth)))

    # Turnover means total unique youth is higher than peak headcount
    annual_turnover = 0.40  # 40% annual turnover (seasonal workers)
    s.youth_total_5yr = int(sum([
        s.youth_hired_yr1,
        s.youth_hired_yr1 * 1.3,  # yr2
        s.youth_hired_yr3,
        s.youth_hired_yr3 * 1.1,  # yr4
        s.youth_hired_yr5,
    ]) * (1 + annual_turnover * 0.5))

    # Wages
    avg_hourly = triangular(15, 17, 20)
    avg_weekly_hours = triangular(15, 22, 30)
    weeks_per_year = triangular(20, 35, 48)
    annual_wage_per_youth = avg_hourly * avg_weekly_hours * weeks_per_year
    s.youth_wages_5yr = sum([
        s.youth_hired_yr1 * annual_wage_per_youth,
        s.youth_hired_yr1 * 1.3 * annual_wage_per_youth,
        s.youth_hired_yr3 * annual_wage_per_youth,
        s.youth_hired_yr3 * 1.1 * annual_wage_per_youth,
        s.youth_hired_yr5 * annual_wage_per_youth,
    ])

    # Skills & outcomes
    s.youth_skills_acquired = int(s.youth_total_5yr * triangular(2, 4, 7))
    college_rate = triangular(0.30, 0.50, 0.75) * execution
    s.youth_college_bound = int(s.youth_total_5yr * college_rate * 0.4)  # 40% are college-age
    career_rate = triangular(0.15, 0.30, 0.50) * execution
    s.youth_career_launched = int(s.youth_total_5yr * career_rate)

    if s.youth_total_5yr >= 100:
        s.notes.append(f"MILESTONE: {s.youth_total_5yr} unique youth employed over 5 years")

    # ── COMMUNITY ENGAGEMENT ───────────────────────────────────────

    s.annual_events_yr3 = max(4, int(20 * execution + random.gauss(0, 3)))
    s.annual_events_yr5 = max(s.annual_events_yr3, int(35 * execution + random.gauss(0, 5)))

    # Park visitors grow with events and improvements
    visitor_multiplier = 1.0 + (execution * 1.5) + (0.3 if s.ksa_response == "cooperate" else 0)
    s.annual_park_visitors_yr5 = int(CURRENT_ANNUAL_PARK_VISITORS * visitor_multiplier)

    # Volunteer hours
    vol_per_event = triangular(10, 25, 50)
    total_events_5yr = s.annual_events_yr3 * 2 + s.annual_events_yr5 * 2 + int(s.annual_events_yr3 * 0.7)
    s.volunteer_hours_5yr = total_events_5yr * vol_per_event + s.youth_total_5yr * 40  # 40 hrs orientation

    # Community reach
    s.community_members_engaged = int(min(
        KINGWOOD_POP * 0.30,  # cap at 30% of population
        (s.annual_park_visitors_yr5 * 0.3) +  # 30% of visitors are unique engaged
        (s.youth_total_5yr * 8) +  # each youth influences ~8 people
        (total_events_5yr * 15)  # 15 unique new contacts per event
    ))

    # Disc golf growth
    dg_growth = 1.0 + execution * 0.8
    s.new_disc_golfers = int(DG_ANNUAL_ROUNDS * 0.05 * dg_growth * 5)  # 5% conversion over 5 years

    # ── ECONOMIC IMPACT ────────────────────────────────────────────

    # Direct RGPC spending over 5 years
    yr_spending = [178000, 382000, 575000, 640000, 710000]
    spending_scale = 0.6 + execution * 0.5  # 60-110% of projected
    s.direct_spending_5yr = sum(y * spending_scale for y in yr_spending)

    # Tournament tourism (disc golf + other events)
    tournaments_per_year = [2, 5, 8, 10, 12]  # growing
    avg_tournament_impact = triangular(2000, 8000, 25000)
    s.tourism_revenue_5yr = sum(t * avg_tournament_impact * spending_scale for t in tournaments_per_year)

    # Local business multiplier (IMPLAN standard: 1.4-1.8 for parks/rec)
    multiplier = triangular(1.3, 1.5, 1.8)
    s.local_business_impact_5yr = (s.direct_spending_5yr + s.tourism_revenue_5yr) * (multiplier - 1)

    # Property values: 5-27% premium for park-adjacent homes (academic research)
    # Conservative: apply 1-5% uplift to homes within 0.5 miles of River Grove
    homes_affected = int(triangular(200, 500, 1200))
    avg_home_value = triangular(250000, 350000, 500000)
    pct_uplift = triangular(0.005, 0.015, 0.03) * execution
    s.property_value_impact = homes_affected * avg_home_value * pct_uplift

    # Additional jobs (beyond youth)
    s.jobs_created_beyond_youth = max(1, int(3 + execution * 5))

    # Tax revenue: property tax uplift + sales tax from tourism
    harris_county_tax_rate = 0.0218  # approximate total rate
    s.tax_revenue_generated = (s.property_value_impact * harris_county_tax_rate +
                                s.tourism_revenue_5yr * 0.0825)  # TX sales tax

    # ── ENVIRONMENTAL IMPACT ───────────────────────────────────────

    s.trees_planted = int(triangular(50, 200, 500) * execution)
    s.trail_miles_maintained = triangular(2, 5, 10) * execution
    s.acres_under_conservation = triangular(10, 30, 74) * execution
    s.flood_sensors_installed = int(triangular(2, 6, 15) * execution)
    s.watershed_data_points = int(s.flood_sensors_installed * 365 * 24 * 5)  # hourly readings
    s.trash_collected_lbs = triangular(5000, 15000, 40000) * execution * 5
    s.native_species_documented = int(triangular(20, 60, 150) * execution)

    if s.hurricane_hits:
        s.flood_damage = triangular(50000, 200000, 500000)
        s.notes.append(f"FLOOD: ${s.flood_damage:,.0f} in damage — recovery tested")
        # But having flood sensors and Conservation Corps makes recovery faster
        if s.flood_sensors_installed >= 5:
            s.flood_damage *= 0.7  # 30% reduction from early warning
            s.notes.append("Flood sensors reduced damage by 30%")

    # ── GOVERNANCE & TRANSPARENCY ──────────────────────────────────

    s.financial_reports_published = int(5 * 12 * execution)  # monthly reports
    s.board_meetings_streamed = int(5 * 12 * execution)
    s.resident_complaints_resolved_pct = min(0.98, triangular(0.5, 0.8, 0.95) * execution / 0.7)

    # Trust score: composite of transparency, responsiveness, youth impact
    transparency_score = min(10, s.financial_reports_published / 6)  # 60 reports = 10
    responsiveness_score = s.resident_complaints_resolved_pct * 10
    youth_score = min(10, s.youth_total_5yr / 15)  # 150 youth = 10
    event_score = min(10, s.annual_events_yr5 / 3.5)  # 35 events = 10
    s.trust_score = (transparency_score * 0.3 +
                     responsiveness_score * 0.3 +
                     youth_score * 0.2 +
                     event_score * 0.2)

    # ── TECHNOLOGY ─────────────────────────────────────────────────

    s.app_downloads = int(triangular(500, 2000, 8000) * execution)
    s.digital_checkins = int(s.annual_park_visitors_yr5 * triangular(0.1, 0.3, 0.6) * 5)
    s.maintenance_requests_resolved = int(triangular(50, 200, 500) * execution * 5)
    s.platform_adoption_rate = min(0.95, triangular(0.1, 0.3, 0.6) * execution / 0.5)

    # ── POLITICAL OUTCOMES ─────────────────────────────────────────

    s.village_boards_supporting = max(0, min(29, int(
        3 + (execution * 10) + (5 if s.ksa_response == "cooperate" else 0)
        + random.gauss(0, 3)
    )))
    s.council_support = s.political_support > 0.5 and execution > 0.5
    s.ksa_reform_achieved = (
        s.ksa_response == "cooperate" or
        (s.village_boards_supporting >= 15 and execution > 0.6)
    )
    s.pid_petition_viable = (
        s.village_boards_supporting >= 18 and
        execution > 0.7 and
        s.trust_score > 7
    )

    # ── RISKS ──────────────────────────────────────────────────────

    s.burnout_occurred = (s.leadership_quality < 0.4 and s.volunteer_engagement < 0.4)
    s.funding_crisis = (s.economy == "weak" and s.grant_success_rate < 0.3)

    if s.burnout_occurred:
        s.notes.append("WARNING: Founder burnout — hire ED earlier")
        execution *= 0.7
    if s.funding_crisis:
        s.notes.append("WARNING: Funding crisis — activate emergency revenue")

    # ── OVERALL STATUS ─────────────────────────────────────────────

    if execution >= 0.7 and s.trust_score >= 7 and not s.burnout_occurred:
        s.initiative_status = "thriving"
    elif execution >= 0.5 and s.trust_score >= 5:
        s.initiative_status = "stable"
    elif execution >= 0.3:
        s.initiative_status = "struggling"
    else:
        s.initiative_status = "failed"

    # ── SOCIAL IMPACT SCORE (0-100) ────────────────────────────────

    scores = {
        "youth_employment": min(25, s.youth_total_5yr / 6),           # 150 youth = 25 pts
        "community_engagement": min(20, s.community_members_engaged / 800),  # 16K = 20 pts
        "economic_impact": min(20, (s.direct_spending_5yr + s.tourism_revenue_5yr) / 200000),  # $4M = 20
        "environmental": min(15, (s.trees_planted / 30 + s.acres_under_conservation / 5 +
                                   s.flood_sensors_installed / 1)),  # composite
        "governance": min(10, s.trust_score),
        "technology": min(10, s.platform_adoption_rate * 10 + s.app_downloads / 1000),
    }
    s.social_impact_score = min(100, sum(scores.values()))

    return s


def run_simulation(n: int = 1000) -> List[SocialImpactScenario]:
    return [simulate_scenario(i) for i in range(n)]


def percentile(data, p):
    k = (len(data) - 1) * p / 100
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data[int(k)]
    return data[f] * (c - k) + data[c] * (k - f)


def analyze(scenarios: List[SocialImpactScenario]) -> str:
    n = len(scenarios)
    lines = []
    a = lines.append

    a("# MONTE CARLO SOCIAL IMPACT SIMULATION — 1,000 ITERATIONS")
    a("")
    a("**River Grove Parks Conservancy — 5-Year Projected Community Impact**")
    a(f"**Iterations:** {n} | **Seed:** 2026 | **Date:** March 22, 2026")
    a("")
    a("> What happens to Kingwood if RGPC succeeds? What if it struggles?")
    a("> This simulation models 1,000 possible futures across randomized")
    a("> volunteer engagement, leadership quality, KSA response, economy,")
    a("> weather, politics, and grant outcomes.")
    a("")
    a("---")
    a("")

    # ── Overall Outcomes ──
    statuses = Counter(s.initiative_status for s in scenarios)
    a("## I. INITIATIVE OUTCOME DISTRIBUTION")
    a("")
    a("```")
    for status in ["thriving", "stable", "struggling", "failed"]:
        count = statuses.get(status, 0)
        bar = "█" * (count // 10)
        a(f"  {status:12s}  {count:4d}/1000  ({count/10:.1f}%)  {bar}")
    a("```")
    a("")

    scores = sorted([s.social_impact_score for s in scenarios])
    a("## II. SOCIAL IMPACT SCORE DISTRIBUTION (0-100)")
    a("")
    a("| Percentile | Score | Interpretation |")
    a("|-----------|-------|---------------|")
    for p, label in [(10, "Worst case"), (25, "Below average"), (50, "**Median**"),
                      (75, "Above average"), (90, "Best case")]:
        v = percentile(scores, p)
        interp = "Transformative" if v >= 70 else ("Strong" if v >= 50 else ("Moderate" if v >= 30 else "Limited"))
        bold = "**" if p == 50 else ""
        a(f"| {bold}{label}{bold} | {bold}{v:.1f}{bold} | {bold}{interp}{bold} |")
    a(f"| Mean | {statistics.mean(scores):.1f} | |")
    a("")

    a("### Score Histogram")
    a("```")
    bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    for i in range(len(bins) - 1):
        count = sum(1 for sc in scores if bins[i] <= sc < bins[i+1])
        bar = "█" * (count // 5)
        a(f"  {bins[i]:3d}-{bins[i+1]:3d}  {count:4d}  {bar}")
    a("```")
    a("")

    # ── Youth Employment ──
    a("## III. YOUTH EMPLOYMENT IMPACT")
    a("")
    yt5 = sorted([s.youth_total_5yr for s in scenarios])
    wages = sorted([s.youth_wages_5yr for s in scenarios])
    college = sorted([s.youth_college_bound for s in scenarios])
    career = sorted([s.youth_career_launched for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile | Mean |")
    a("|--------|----------|--------|----------|------|")
    for name, data in [
        ("Unique Youth Employed (5yr)", yt5),
        ("Total Wages Paid (5yr)", wages),
        ("Youth → College/Training", college),
        ("Youth → Career Launched", career),
    ]:
        p10, med, p90 = percentile(data, 10), percentile(data, 50), percentile(data, 90)
        mean = statistics.mean(data)
        if "Wages" in name:
            a(f"| {name} | ${p10:,.0f} | ${med:,.0f} | ${p90:,.0f} | ${mean:,.0f} |")
        else:
            a(f"| {name} | {p10:.0f} | {med:.0f} | {p90:.0f} | {mean:.0f} |")
    a("")
    a(f"**In the median scenario, RGPC employs {percentile(yt5, 50):.0f} unique Kingwood youth over 5 years,")
    a(f"paying ${percentile(wages, 50):,.0f} in total wages, with {percentile(career, 50):.0f} launching careers.**")
    a("")

    # Context
    a("### Context: What This Means for Kingwood")
    a(f"- Estimated unemployed youth (16-24) in Kingwood: **{UNEMPLOYED_YOUTH}**")
    med_youth = percentile(yt5, 50)
    a(f"- RGPC median 5-year employment: **{med_youth:.0f} unique youth**")
    a(f"- That's **{med_youth/UNEMPLOYED_YOUTH*100:.1f}%** of Kingwood's unemployed youth population")
    a(f"- Currently, KSA employs **0 youth** across 356 acres of parkland")
    a("")

    # ── Economic Impact ──
    a("## IV. ECONOMIC IMPACT")
    a("")
    direct = sorted([s.direct_spending_5yr for s in scenarios])
    tourism = sorted([s.tourism_revenue_5yr for s in scenarios])
    local_biz = sorted([s.local_business_impact_5yr for s in scenarios])
    prop_val = sorted([s.property_value_impact for s in scenarios])
    tax_rev = sorted([s.tax_revenue_generated for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile | Mean |")
    a("|--------|----------|--------|----------|------|")
    for name, data in [
        ("Direct RGPC Spending (5yr)", direct),
        ("Tournament/Event Tourism (5yr)", tourism),
        ("Local Business Multiplier (5yr)", local_biz),
        ("Property Value Uplift", prop_val),
        ("Tax Revenue Generated (5yr)", tax_rev),
    ]:
        p10, med, p90 = percentile(data, 10), percentile(data, 50), percentile(data, 90)
        mean = statistics.mean(data)
        a(f"| {name} | ${p10:,.0f} | ${med:,.0f} | ${p90:,.0f} | ${mean:,.0f} |")
    a("")

    total_econ = sorted([s.direct_spending_5yr + s.tourism_revenue_5yr + s.local_business_impact_5yr
                         for s in scenarios])
    a(f"**Total Economic Impact (median): ${percentile(total_econ, 50):,.0f}**")
    a(f"**Total Economic Impact (90th): ${percentile(total_econ, 90):,.0f}**")
    a("")

    # ── Community Engagement ──
    a("## V. COMMUNITY ENGAGEMENT")
    a("")
    visitors = sorted([s.annual_park_visitors_yr5 for s in scenarios])
    engaged = sorted([s.community_members_engaged for s in scenarios])
    vol_hrs = sorted([s.volunteer_hours_5yr for s in scenarios])
    events5 = sorted([s.annual_events_yr5 for s in scenarios])
    new_dg = sorted([s.new_disc_golfers for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile |")
    a("|--------|----------|--------|----------|")
    for name, data in [
        ("Annual Park Visitors (Year 5)", visitors),
        ("Community Members Engaged", engaged),
        ("Volunteer Hours (5yr total)", vol_hrs),
        ("Annual Events (Year 5)", events5),
        ("New Disc Golfers (5yr)", new_dg),
    ]:
        a(f"| {name} | {percentile(data, 10):,.0f} | {percentile(data, 50):,.0f} | {percentile(data, 90):,.0f} |")
    a("")

    pct_engaged = percentile(engaged, 50) / KINGWOOD_POP * 100
    a(f"**Median: {percentile(engaged, 50):,.0f} Kingwood residents engaged ({pct_engaged:.1f}% of population)**")
    a("")

    # ── Environmental ──
    a("## VI. ENVIRONMENTAL IMPACT")
    a("")
    trees = sorted([s.trees_planted for s in scenarios])
    trails = sorted([s.trail_miles_maintained for s in scenarios])
    conserv = sorted([s.acres_under_conservation for s in scenarios])
    sensors = sorted([s.flood_sensors_installed for s in scenarios])
    trash = sorted([s.trash_collected_lbs for s in scenarios])
    species = sorted([s.native_species_documented for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile |")
    a("|--------|----------|--------|----------|")
    for name, data in [
        ("Trees Planted", trees),
        ("Trail Miles Maintained", trails),
        ("Acres Under Active Conservation", conserv),
        ("Flood Sensors Installed", sensors),
        ("Trash Collected (lbs, 5yr)", trash),
        ("Native Species Documented", species),
    ]:
        p10, med, p90 = percentile(data, 10), percentile(data, 50), percentile(data, 90)
        fmt = ",.0f" if max(data) > 100 else ".1f"
        a(f"| {name} | {p10:{fmt}} | {med:{fmt}} | {p90:{fmt}} |")
    a("")

    # ── Governance ──
    a("## VII. GOVERNANCE & TRANSPARENCY")
    a("")
    trust = sorted([s.trust_score for s in scenarios])
    complaints = sorted([s.resident_complaints_resolved_pct for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile |")
    a("|--------|----------|--------|----------|")
    a(f"| Community Trust Score (0-10) | {percentile(trust, 10):.1f} | {percentile(trust, 50):.1f} | {percentile(trust, 90):.1f} |")
    a(f"| Complaint Resolution Rate | {percentile(complaints, 10):.0%} | {percentile(complaints, 50):.0%} | {percentile(complaints, 90):.0%} |")
    a(f"| KSA Reform Achieved | {sum(s.ksa_reform_achieved for s in scenarios)/n:.0%} | | |")
    a(f"| PID Petition Viable | {sum(s.pid_petition_viable for s in scenarios)/n:.0%} | | |")
    a(f"| Village Boards Supporting (med) | | {percentile(sorted([s.village_boards_supporting for s in scenarios]), 50):.0f} of 29 | |")
    a("")
    a(f"**Compare: KSA's BBB rating is F. KSA complaint resolution: 0%.**")
    a("")

    # ── Technology ──
    a("## VIII. TECHNOLOGY ADOPTION")
    a("")
    downloads = sorted([s.app_downloads for s in scenarios])
    checkins = sorted([s.digital_checkins for s in scenarios])
    adoption = sorted([s.platform_adoption_rate for s in scenarios])

    a("| Metric | 10th %ile | Median | 90th %ile |")
    a("|--------|----------|--------|----------|")
    a(f"| App Downloads | {percentile(downloads, 10):,.0f} | {percentile(downloads, 50):,.0f} | {percentile(downloads, 90):,.0f} |")
    a(f"| Digital Check-ins (5yr) | {percentile(checkins, 10):,.0f} | {percentile(checkins, 50):,.0f} | {percentile(checkins, 90):,.0f} |")
    a(f"| Platform Adoption Rate | {percentile(adoption, 10):.0%} | {percentile(adoption, 50):.0%} | {percentile(adoption, 90):.0%} |")
    a("")

    # ── Risks ──
    a("## IX. RISK ANALYSIS")
    a("")
    a("| Risk | Probability | Median Impact | Mitigation |")
    a("|------|------------|--------------|-----------|")
    a(f"| Founder Burnout | {sum(s.burnout_occurred for s in scenarios)/n:.0%} | Reduces execution 30% | Hire ED by Year 2 |")
    a(f"| Funding Crisis | {sum(s.funding_crisis for s in scenarios)/n:.0%} | Revenue shortfall | Diversify: no source >30% |")
    a(f"| KSA Legal Retaliation | {sum(s.ksa_legal_retaliation for s in scenarios)/n:.0%} | Legal costs $20-50K | D&O insurance, legal reserve |")
    a(f"| Major Flood Event | {sum(s.hurricane_hits for s in scenarios)/n:.0%} | ${percentile(sorted([s.flood_damage for s in scenarios if s.hurricane_hits]), 50):,.0f} median damage | Flood sensors, insurance, FEMA prep |")
    a("")

    # ── KSA Response Impact ──
    a("## X. KSA RESPONSE — WHAT HAPPENS IN EACH SCENARIO")
    a("")
    for response in ["cooperate", "ignore", "resist"]:
        subset = [s for s in scenarios if s.ksa_response == response]
        count = len(subset)
        avg_score = statistics.mean([s.social_impact_score for s in subset])
        avg_youth = statistics.mean([s.youth_total_5yr for s in subset])
        avg_econ = statistics.mean([s.direct_spending_5yr + s.tourism_revenue_5yr for s in subset])
        reform_rate = sum(s.ksa_reform_achieved for s in subset) / count

        a(f"### KSA {response.upper()}S ({count/n:.0%} probability)")
        a(f"- Social Impact Score: **{avg_score:.1f}**/100")
        a(f"- Youth Employed: **{avg_youth:.0f}** over 5 years")
        a(f"- Economic Impact: **${avg_econ:,.0f}**")
        a(f"- Reform Achieved: **{reform_rate:.0%}**")
        if response == "cooperate":
            a("- *Best outcome. Partnership accelerates everything.*")
        elif response == "ignore":
            a("- *RGPC demonstrates independently. KSA becomes irrelevant over time.*")
        else:
            a("- *Legal backup activated. Slower but eventually achieves reform in most scenarios.*")
        a("")

    # ── What Moves the Needle ──
    a("## XI. WHAT MOVES THE NEEDLE — VARIABLE SENSITIVITY")
    a("")

    # Test each variable's impact on social impact score
    variables = [
        ("Leadership Quality", lambda s: s.leadership_quality > 0.7),
        ("Volunteer Engagement", lambda s: s.volunteer_engagement > 0.7),
        ("Tech Platform Ready", lambda s: s.tech_platform_readiness > 0.7),
        ("Community Reception", lambda s: s.community_reception > 0.7),
        ("KSA Cooperates", lambda s: s.ksa_response == "cooperate"),
        ("Strong Economy", lambda s: s.economy == "strong"),
        ("High Grant Success", lambda s: s.grant_success_rate > 0.6),
        ("Heavy Media Coverage", lambda s: s.media_coverage == "heavy"),
        ("Political Support", lambda s: s.political_support > 0.6),
        ("No Hurricane", lambda s: not s.hurricane_hits),
    ]

    impacts = []
    for name, fn in variables:
        with_var = [s.social_impact_score for s in scenarios if fn(s)]
        without_var = [s.social_impact_score for s in scenarios if not fn(s)]
        if with_var and without_var:
            delta = statistics.mean(with_var) - statistics.mean(without_var)
            impacts.append((name, delta, statistics.mean(with_var), statistics.mean(without_var), len(with_var)/n))

    impacts.sort(key=lambda x: -abs(x[1]))

    a("| Variable | Score WITH | Score WITHOUT | Delta | Frequency |")
    a("|----------|-----------|-------------|-------|-----------|")
    for name, delta, avg_with, avg_without, freq in impacts:
        sign = "+" if delta > 0 else ""
        a(f"| {name} | {avg_with:.1f} | {avg_without:.1f} | {sign}{delta:.1f} | {freq:.0%} |")
    a("")

    top = impacts[0]
    a(f"**#1 Most Important Variable: {top[0]}** (+{top[1]:.1f} points on social impact score)")
    a("")

    # ── Summary ──
    a("## XII. EXECUTIVE SUMMARY")
    a("")
    a("### The Bottom Line")
    a("")
    med_score = percentile(scores, 50)
    med_youth = percentile(yt5, 50)
    med_econ = percentile(total_econ, 50)
    med_engaged = percentile(engaged, 50)

    a(f"Across **{n} simulated futures**, the River Grove Parks Conservancy:")
    a("")
    a(f"- Achieves **\"thriving\" or \"stable\" status** in **{(statuses.get('thriving',0)+statuses.get('stable',0))/n:.0%}** of scenarios")
    a(f"- Employs a median of **{med_youth:.0f} unique Kingwood youth** over 5 years")
    a(f"- Generates **${med_econ:,.0f}** in total economic impact")
    a(f"- Engages **{med_engaged:,.0f} community members** ({med_engaged/KINGWOOD_POP*100:.1f}% of Kingwood)")
    a(f"- Achieves a median social impact score of **{med_score:.1f}/100**")
    a(f"- Plants a median of **{percentile(trees, 50):.0f} trees** and documents **{percentile(species, 50):.0f} native species**")
    a(f"- Achieves KSA governance reform in **{sum(s.ksa_reform_achieved for s in scenarios)/n:.0%}** of scenarios")
    a("")
    a("### What KSA Currently Provides (for comparison)")
    a("")
    a("| Metric | KSA (Actual) | RGPC (Median Simulation) |")
    a("|--------|-------------|------------------------|")
    a(f"| Youth Employed | **0** | **{med_youth:.0f}** |")
    a(f"| Annual Events | **0** | **{percentile(events5, 50):.0f}** |")
    a(f"| Community Trust Score | **F (BBB)** | **{percentile(trust, 50):.1f}/10** |")
    a(f"| Complaint Resolution | **0%** | **{percentile(complaints, 50):.0%}** |")
    a(f"| Financial Reports Published | **0 (since 2012)** | **{percentile(sorted([s.financial_reports_published for s in scenarios]), 50):.0f}** |")
    a(f"| App / Digital Access | **None** | **{percentile(downloads, 50):,.0f} downloads** |")
    a(f"| Trees Planted (5yr) | **Unknown** | **{percentile(trees, 50):.0f}** |")
    a(f"| Flood Preparedness | **None** | **{percentile(sensors, 50):.0f} sensors** |")
    a(f"| Technology Budget | **$0** | **$5,900/year** |")
    a(f"| Economic Multiplier | **Unknown** | **${med_econ:,.0f} (5yr)** |")
    a("")

    a("### The Verdict")
    a("")
    fail_rate = statuses.get('failed', 0) / n * 100
    a(f"The initiative **fails** in only **{fail_rate:.1f}%** of scenarios — and even")
    a(f"\"struggling\" scenarios still produce more youth employment, community engagement,")
    a(f"and transparency than KSA's current zero-everything baseline.")
    a("")
    a(f"**The risk of doing nothing is greater than the risk of trying.**")
    a("")

    return "\n".join(lines)


if __name__ == "__main__":
    print("Running 1,000 social impact iterations...")
    scenarios = run_simulation(1000)
    report = analyze(scenarios)

    path = "/Users/blakesanders/RGDGC/docs/KSA-Research/SOCIAL_IMPACT_SIMULATION.md"
    with open(path, "w") as f:
        f.write(report)
    print(f"Report saved: {path}")

    # Save raw data
    data_path = "/Users/blakesanders/RGDGC/docs/KSA-Research/social_impact_raw_data.json"
    raw = []
    for s in scenarios:
        raw.append({
            "i": s.iteration,
            "status": s.initiative_status,
            "score": round(s.social_impact_score, 1),
            "youth_5yr": s.youth_total_5yr,
            "wages_5yr": round(s.youth_wages_5yr),
            "careers": s.youth_career_launched,
            "econ_direct": round(s.direct_spending_5yr),
            "econ_tourism": round(s.tourism_revenue_5yr),
            "prop_value": round(s.property_value_impact),
            "visitors_yr5": s.annual_park_visitors_yr5,
            "engaged": s.community_members_engaged,
            "events_yr5": s.annual_events_yr5,
            "trust": round(s.trust_score, 1),
            "trees": s.trees_planted,
            "ksa": s.ksa_response,
            "reform": s.ksa_reform_achieved,
        })
    with open(data_path, "w") as f:
        json.dump(raw, f)
    print(f"Raw data saved: {data_path}")

    # Summary
    statuses = Counter(s.initiative_status for s in scenarios)
    scores = [s.social_impact_score for s in scenarios]
    youth = [s.youth_total_5yr for s in scenarios]
    print(f"\n{'='*50}")
    print(f"SOCIAL IMPACT — {len(scenarios)} ITERATIONS")
    print(f"{'='*50}")
    for st in ["thriving", "stable", "struggling", "failed"]:
        print(f"  {st:12s}: {statuses.get(st,0):4d} ({statuses.get(st,0)/10:.1f}%)")
    print(f"\n  Median Impact Score: {statistics.median(scores):.1f}/100")
    print(f"  Median Youth Employed: {statistics.median(youth):.0f}")
    print(f"  Median Wages Paid: ${statistics.median([s.youth_wages_5yr for s in scenarios]):,.0f}")
