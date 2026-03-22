"""Message formatting utilities for Discord (Markdown) and Telegram (HTML)."""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _ordinal(n: int) -> str:
    """Return ordinal string for an integer (1st, 2nd, 3rd, ...)."""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _score_display(score: int) -> str:
    """Format a score relative to par."""
    if score == 0:
        return "E"
    return f"+{score}" if score > 0 else str(score)


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

def format_leaderboard(data: dict[str, Any], *, html: bool = False) -> str:
    """Format league standings into a readable table.

    Args:
        data: API response from ``/leagues/{id}/leaderboard``.
        html: If True, format for Telegram (HTML). Otherwise Discord Markdown.
    """
    league_name = data.get("league_name", "League")
    season = data.get("season", "")
    entries: list[dict[str, Any]] = data.get("standings", data.get("entries", []))

    if not entries:
        return f"No standings available for {league_name}."

    header = f"{league_name} — {season} Standings" if season else f"{league_name} Standings"

    lines: list[str] = []
    if html:
        lines.append(f"<b>{header}</b>\n")
        for e in entries[:25]:
            pos = e.get("position", "?")
            name = e.get("player_name", "Unknown")
            pts = e.get("points", 0)
            events = e.get("events_played", 0)
            lines.append(f"{_ordinal(pos)}  <b>{name}</b> — {pts} pts ({events} events)")
    else:
        lines.append(f"**{header}**\n```")
        lines.append(f"{'#':>3}  {'Player':<20} {'Pts':>5}  {'Events':>6}")
        lines.append("-" * 42)
        for e in entries[:25]:
            pos = e.get("position", "?")
            name = e.get("player_name", "Unknown")[:20]
            pts = e.get("points", 0)
            events = e.get("events_played", 0)
            lines.append(f"{pos:>3}  {name:<20} {pts:>5}  {events:>6}")
        lines.append("```")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Event details
# ---------------------------------------------------------------------------

def format_event(data: dict[str, Any], *, html: bool = False) -> str:
    """Format a single event's details."""
    name = data.get("name", data.get("league_name", "Event"))
    date = data.get("event_date", "TBD")
    course = data.get("course_name", "")
    layout = data.get("layout_name", "")
    status = data.get("status", "upcoming")
    checkins = data.get("checkin_count", "?")

    location = f"{course} ({layout})" if layout else course

    if html:
        parts = [
            f"<b>{name}</b>",
            f"Date: {date}",
        ]
        if location:
            parts.append(f"Course: {location}")
        parts.append(f"Status: {status.capitalize()}")
        parts.append(f"Checked in: {checkins}")
        return "\n".join(parts)

    parts = [
        f"**{name}**",
        f"Date: {date}",
    ]
    if location:
        parts.append(f"Course: {location}")
    parts.append(f"Status: {status.capitalize()}")
    parts.append(f"Checked in: {checkins}")
    return "\n".join(parts)


def format_events_list(events: list[dict[str, Any]], *, html: bool = False) -> str:
    """Format a list of upcoming events."""
    if not events:
        return "No upcoming events scheduled."

    if html:
        header = "<b>Upcoming Events</b>\n"
    else:
        header = "**Upcoming Events**\n"

    items: list[str] = []
    for ev in events[:10]:
        name = ev.get("name", ev.get("league_name", "Event"))
        date = ev.get("event_date", "TBD")
        if html:
            items.append(f"- <b>{name}</b> — {date}")
        else:
            items.append(f"- **{name}** — {date}")

    return header + "\n".join(items)


# ---------------------------------------------------------------------------
# Player stats
# ---------------------------------------------------------------------------

def format_player_stats(data: dict[str, Any], *, html: bool = False) -> str:
    """Format player statistics summary."""
    name = data.get("player_name", data.get("username", "Player"))
    handicap = data.get("handicap")
    rounds_played = data.get("rounds_played", 0)
    avg_score = data.get("avg_score")
    best_score = data.get("best_score")
    putting = data.get("putting", {})

    b = "**" if not html else ""
    bh = "<b>" if html else ""
    bh_end = "</b>" if html else ""

    lines: list[str] = [f"{bh}{b}{name}{b}{bh_end}\n"]

    if handicap is not None:
        lines.append(f"Handicap: {handicap:+.1f}")
    lines.append(f"Rounds played: {rounds_played}")
    if avg_score is not None:
        lines.append(f"Avg score: {_score_display(round(avg_score))}")
    if best_score is not None:
        lines.append(f"Best round: {_score_display(best_score)}")

    if putting:
        c1x = putting.get("c1x_pct")
        c2 = putting.get("c2_pct")
        if c1x is not None:
            lines.append(f"C1X putting: {c1x:.0%}")
        if c2 is not None:
            lines.append(f"C2 putting: {c2:.0%}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Disc info
# ---------------------------------------------------------------------------

def format_disc_info(data: dict[str, Any], *, html: bool = False) -> str:
    """Format disc details (flight numbers, manufacturer, etc.)."""
    name = data.get("name", "Unknown Disc")
    manufacturer = data.get("manufacturer", "")
    speed = data.get("speed", "?")
    glide = data.get("glide", "?")
    turn = data.get("turn", "?")
    fade = data.get("fade", "?")
    disc_type = data.get("type", "")

    flight = f"{speed} / {glide} / {turn} / {fade}"

    if html:
        lines = [f"<b>{name}</b>"]
        if manufacturer:
            lines.append(f"Manufacturer: {manufacturer}")
        if disc_type:
            lines.append(f"Type: {disc_type}")
        lines.append(f"Flight numbers: {flight}")
    else:
        lines = [f"**{name}**"]
        if manufacturer:
            lines.append(f"Manufacturer: {manufacturer}")
        if disc_type:
            lines.append(f"Type: {disc_type}")
        lines.append(f"Flight numbers: `{flight}`")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Event results
# ---------------------------------------------------------------------------

def format_event_results(data: dict[str, Any], *, html: bool = False) -> str:
    """Format results for a completed event."""
    name = data.get("name", data.get("league_name", "Event"))
    date = data.get("event_date", "")
    results: list[dict[str, Any]] = data.get("results", [])

    if not results:
        return f"No results available for {name}."

    if html:
        header = f"<b>{name}</b> — {date}\n"
        lines = [header]
        for r in results[:25]:
            pos = _ordinal(r.get("position", 0))
            player = r.get("player_name", "Unknown")
            score = _score_display(r.get("total_score", 0))
            strokes = r.get("total_strokes", "")
            pts = r.get("points_earned", 0)
            lines.append(f"{pos}  <b>{player}</b>  {score} ({strokes})  — {pts} pts")
    else:
        header = f"**{name}** — {date}\n```"
        lines = [header]
        lines.append(f"{'#':>3}  {'Player':<18} {'Score':>6} {'Strokes':>7} {'Pts':>4}")
        lines.append("-" * 44)
        for r in results[:25]:
            pos = r.get("position", 0)
            player = r.get("player_name", "Unknown")[:18]
            score = _score_display(r.get("total_score", 0))
            strokes = r.get("total_strokes", "")
            pts = r.get("points_earned", 0)
            lines.append(f"{pos:>3}  {player:<18} {score:>6} {strokes:>7} {pts:>4}")
        lines.append("```")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Rule lookup
# ---------------------------------------------------------------------------

def format_rule(data: dict[str, Any], *, html: bool = False) -> str:
    """Format a PDGA rule lookup result."""
    rules: list[dict[str, Any]] = data.get("rules", data.get("results", []))
    if not rules:
        return "No matching rules found."

    lines: list[str] = []
    for rule in rules[:3]:
        number = rule.get("number", "")
        title = rule.get("title", "")
        text = rule.get("text", "")
        if html:
            lines.append(f"<b>{number} — {title}</b>\n{text}\n")
        else:
            lines.append(f"**{number} — {title}**\n{text}\n")

    return "\n".join(lines).strip()


# ---------------------------------------------------------------------------
# Course info
# ---------------------------------------------------------------------------

def format_course_info(data: dict[str, Any], *, html: bool = False) -> str:
    """Format course/layout information."""
    # Handle both single course and list responses
    if not data:
        return "Course information unavailable."
    course = data if "name" in data else (data.get("courses", [data])[0] if data else {})

    name = course.get("name", "Unknown Course")
    location = course.get("location", "")
    layouts: list[dict[str, Any]] = course.get("layouts", [])

    if html:
        lines = [f"<b>{name}</b>"]
        if location:
            lines.append(f"Location: {location}")
        for layout in layouts:
            lname = layout.get("name", "")
            holes = layout.get("holes", "?")
            par = layout.get("total_par", "?")
            diff = layout.get("difficulty", "")
            lines.append(f"\n<b>{lname}</b> — {holes} holes, Par {par}" + (f" ({diff})" if diff else ""))
    else:
        lines = [f"**{name}**"]
        if location:
            lines.append(f"Location: {location}")
        for layout in layouts:
            lname = layout.get("name", "")
            holes = layout.get("holes", "?")
            par = layout.get("total_par", "?")
            diff = layout.get("difficulty", "")
            lines.append(f"\n**{lname}** — {holes} holes, Par {par}" + (f" ({diff})" if diff else ""))

    return "\n".join(lines)
