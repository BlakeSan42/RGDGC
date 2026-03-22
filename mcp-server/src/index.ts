#!/usr/bin/env node
/**
 * RGDGC MCP Server
 *
 * Exposes River Grove Disc Golf Club data to Claude via the
 * Model Context Protocol. Tools map to the RGDGC FastAPI backend.
 *
 * Home course: River Grove DGC — Kingwood, TX (Houston metro, Harris County)
 * Layouts: "All 18 plus 3A" (default/tournament), "Standard 18", "Ryne Theis Memorial"
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.RGDGC_API_URL || "http://localhost:8001";
const API_KEY = process.env.RGDGC_API_KEY || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiGet(path: string): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

// ---------------------------------------------------------------------------
// PDGA Rules (embedded resource)
// ---------------------------------------------------------------------------

const PDGA_RULES: Record<string, string> = {
  ob: `**PDGA Rule 806.02: Out of Bounds**
A disc is OB when it comes to rest completely beyond the OB line.
Penalty: 1 stroke. Options:
1. Previous lie — re-throw from where you threw
2. Last in-bounds — play from 1m into the course from where disc crossed OB line
3. Drop zone — if available, play from designated DZ
If disc lands OB but rolls/slides back in-bounds before coming to rest, it is IN.`,

  mando: `**PDGA Rule 804.01: Mandatory (Mando)**
Arrow indicates required passing side. Missing a mando:
Penalty: 1 stroke. Return to previous lie or play from drop zone if available.`,

  foot_fault: `**PDGA Rule 802.04: Foot Fault (Stance)**
At release, at least one supporting point must be within the lie.
No supporting point may be closer to the target or touching OB.
Penalty: 1 stroke (warning first in casual play).`,

  relief: `**PDGA Rule 803.01: Casual Relief**
Free relief from: casual water, harmful insects/animals, damaged equipment.
Mark lie, move 1m in any direction (not closer to target).`,

  two_meter: `**PDGA Rule 802.04: Two-Meter Rule (if in effect)**
Disc comes to rest 2+ meters above playing surface.
Penalty: 1 stroke. Play from directly below.`,

  courtesy: `**PDGA Rule 812: Courtesy Violations**
Excessive time (30 seconds from lie clear), distracting other players.
Penalty: Warning, then 1 stroke per offense.`,

  time: `**PDGA Rule 802.03: Excessive Time**
A player has 30 seconds to throw after the previous player has thrown
and the playing area is clear. First violation: warning. Subsequent: 1 stroke.`,
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "rgdgc-mcp", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// ── List Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_leaderboard",
      description:
        "Get current season standings/leaderboard for a league. Use when players ask about rankings, points, or standings.",
      inputSchema: {
        type: "object" as const,
        properties: {
          league_id: {
            type: "integer",
            description: 'League ID (1=Dubs, 2=Sunday Singles)',
          },
          limit: {
            type: "integer",
            description: "Number of entries to return (default 10)",
          },
        },
        required: ["league_id"],
      },
    },
    {
      name: "get_player_stats",
      description:
        "Get statistics for a specific player — rounds played, averages, best scores, league history.",
      inputSchema: {
        type: "object" as const,
        properties: {
          player_id: {
            type: "integer",
            description: "Player user ID",
          },
          season: {
            type: "string",
            description: 'Season filter (e.g. "2026")',
          },
        },
        required: ["player_id"],
      },
    },
    {
      name: "get_upcoming_events",
      description:
        "List upcoming league events. Use when players ask about next matches or schedule.",
      inputSchema: {
        type: "object" as const,
        properties: {
          league_id: {
            type: "integer",
            description: "Optional league filter",
          },
          limit: {
            type: "integer",
            description: "Number of events (default 5)",
          },
        },
      },
    },
    {
      name: "get_event_results",
      description:
        "Get results for a completed event — positions, scores, points awarded.",
      inputSchema: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "integer",
            description: "Event ID",
          },
        },
        required: ["event_id"],
      },
    },
    {
      name: "lookup_rule",
      description:
        "Look up PDGA disc golf rules by keyword. Use for OB, mandos, foot faults, relief, time limits, etc.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description:
              'Rule keyword (e.g. "ob", "mando", "foot_fault", "relief", "two_meter", "courtesy", "time")',
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_course_info",
      description:
        "Get course and layout details including hole-by-hole information.",
      inputSchema: {
        type: "object" as const,
        properties: {
          layout_id: {
            type: "integer",
            description: "Layout ID (optional — returns all layouts if omitted)",
          },
        },
      },
    },
    {
      name: "calculate_handicap",
      description:
        "Calculate a player's handicap based on their round history for a specific layout.",
      inputSchema: {
        type: "object" as const,
        properties: {
          player_id: {
            type: "integer",
            description: "Player user ID",
          },
          layout_id: {
            type: "integer",
            description: "Layout to calculate handicap for",
          },
        },
        required: ["player_id"],
      },
    },
    {
      name: "get_player_rounds",
      description:
        "Get recent round history for a player. Includes scores, layouts, and dates.",
      inputSchema: {
        type: "object" as const,
        properties: {
          player_id: {
            type: "integer",
            description: "Player user ID",
          },
          limit: {
            type: "integer",
            description: "Number of rounds (default 10)",
          },
          layout_id: {
            type: "integer",
            description: "Optional layout filter",
          },
        },
        required: ["player_id"],
      },
    },
    {
      name: "get_event_checkins",
      description:
        "Get list of players checked in for an upcoming event.",
      inputSchema: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "integer",
            description: "Event ID",
          },
        },
        required: ["event_id"],
      },
    },
  ],
}));

// ── Call Tools ───────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── Leaderboard ──
    case "get_leaderboard": {
      const leagueId = (args as Record<string, unknown>).league_id;
      const limit = (args as Record<string, unknown>).limit ?? 10;
      const data = (await apiGet(
        `/api/v1/leagues/${leagueId}/leaderboard?limit=${limit}`
      )) as { league_name?: string; leaderboard?: Array<Record<string, unknown>> };

      let result = `**${data.league_name ?? "League"} Standings**\n\n`;
      const entries = data.leaderboard ?? [];
      entries.forEach(
        (entry: Record<string, unknown>, i: number) => {
          const medal =
            i === 0 ? "1." : i === 1 ? "2." : i === 2 ? "3." : `${i + 1}.`;
          result += `${medal} ${entry.player_name}: ${entry.total_points} pts (${entry.events_played} events)\n`;
        }
      );
      return text(result);
    }

    // ── Player Stats ──
    case "get_player_stats": {
      const playerId = (args as Record<string, unknown>).player_id;
      const season = (args as Record<string, unknown>).season ?? "";
      const query = season ? `?season=${season}` : "";
      const data = await apiGet(`/api/v1/users/${playerId}/stats${query}`);
      return text(JSON.stringify(data, null, 2));
    }

    // ── Upcoming Events ──
    case "get_upcoming_events": {
      const leagueId = (args as Record<string, unknown>).league_id;
      const limit = (args as Record<string, unknown>).limit ?? 5;
      // Backend returns array from /events, optionally filtered by status and league_id
      let path = `/api/v1/events?status=upcoming&limit=${limit}`;
      if (leagueId) path += `&league_id=${leagueId}`;
      const data = (await apiGet(path)) as Array<Record<string, unknown>>;

      let result = "**Upcoming Events**\n\n";
      const events = Array.isArray(data) ? data : [];
      if (events.length === 0) return text("No upcoming events scheduled.");
      events.forEach((ev: Record<string, unknown>) => {
        result += `- ${ev.name ?? "League Event"} — ${ev.event_date} (${ev.num_players ?? "?"} registered)\n`;
      });
      return text(result);
    }

    // ── Event Results ──
    case "get_event_results": {
      const eventId = (args as Record<string, unknown>).event_id;
      const data = await apiGet(`/api/v1/events/${eventId}`);
      return text(JSON.stringify(data, null, 2));
    }

    // ── PDGA Rules ──
    case "lookup_rule": {
      const query = String((args as Record<string, unknown>).query).toLowerCase();
      // Search through rules for matching keyword
      const matches: string[] = [];
      for (const [key, rule] of Object.entries(PDGA_RULES)) {
        if (key.includes(query) || rule.toLowerCase().includes(query)) {
          matches.push(rule);
        }
      }
      if (matches.length > 0) {
        return text(matches.join("\n\n---\n\n") + "\n\nFull rules: pdga.com/rules");
      }
      return text(
        `No rules found for "${query}". Try: ob, mando, foot_fault, relief, two_meter, courtesy, time.\nFull rules: pdga.com/rules`
      );
    }

    // ── Course Info ──
    case "get_course_info": {
      const layoutId = (args as Record<string, unknown>).layout_id;
      const path = layoutId
        ? `/api/v1/layouts/${layoutId}`
        : `/api/v1/courses`;
      const data = await apiGet(path);
      return text(JSON.stringify(data, null, 2));
    }

    // ── Handicap ──
    case "calculate_handicap": {
      const playerId = (args as Record<string, unknown>).player_id;
      const layoutId = (args as Record<string, unknown>).layout_id;
      const query = layoutId ? `?layout_id=${layoutId}` : "";
      const data = await apiGet(
        `/api/v1/users/${playerId}/stats${query}`
      );
      return text(JSON.stringify(data, null, 2));
    }

    // ── Player Rounds ──
    case "get_player_rounds": {
      const playerId = (args as Record<string, unknown>).player_id;
      const limit = (args as Record<string, unknown>).limit ?? 10;
      const layoutId = (args as Record<string, unknown>).layout_id;
      let path = `/api/v1/rounds?user_id=${playerId}&limit=${limit}`;
      if (layoutId) path += `&layout_id=${layoutId}`;
      const data = await apiGet(path);
      return text(JSON.stringify(data, null, 2));
    }

    // ── Event Check-ins ──
    case "get_event_checkins": {
      const eventId = (args as Record<string, unknown>).event_id;
      // Backend uses /results endpoint — check-ins create result entries
      const data = await apiGet(`/api/v1/events/${eventId}/results`);
      return text(JSON.stringify(data, null, 2));
    }

    default:
      return text(`Unknown tool: ${name}`);
  }
});

// ── Resources ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "rules://pdga",
      name: "PDGA Rules Reference",
      description: "Official PDGA disc golf rules — OB, mandos, stance, relief, time limits",
      mimeType: "text/plain",
    },
    {
      uri: "course://river-grove",
      name: "River Grove DGC — Kingwood, TX",
      description: "Course details and hole information for River Grove DGC in Kingwood, TX (Houston metro, Harris County). Layouts: All 18 plus 3A (default/tournament), Standard 18, Ryne Theis Memorial.",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "rules://pdga") {
    const allRules = Object.values(PDGA_RULES).join("\n\n---\n\n");
    return {
      contents: [{ uri, mimeType: "text/plain", text: allRules }],
    };
  }

  if (uri === "course://river-grove") {
    const data = await apiGet("/api/v1/courses");
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RGDGC MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
