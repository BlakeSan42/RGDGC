/**
 * Deep linking configuration for RGDGC mobile app.
 *
 * URL scheme:  rgdgc://
 * Web domain:  disc.rgdgc.com
 *
 * Supported routes:
 *   rgdgc://disc/:code   -> /discs/[code]
 *   rgdgc://event/:id    -> /event/[id]
 *   rgdgc://round/:id    -> /round/[id]
 *   rgdgc://course/:id   -> /course/[id]
 *   rgdgc://player/:id   -> /player/[id]
 */

import { LinkingOptions } from "@react-navigation/native";

export const linking: LinkingOptions<any> = {
  prefixes: ["rgdgc://", "https://disc.rgdgc.com"],
  config: {
    screens: {
      "(tabs)": {
        screens: {
          play: "play",
          stats: "stats",
          league: "league",
          chat: "chat",
          profile: "profile",
        },
      },
      "discs/[code]": "disc/:code",
      "event/[id]": "event/:id",
      "round/[id]": "round/:id",
      "course/[id]": "course/:id",
      "player/[id]": "player/:id",
    },
  },
};

/**
 * Helper to build a deep link URL for sharing.
 */
export function buildDeepLink(
  path: "disc" | "event" | "round" | "course" | "player",
  id: string,
): string {
  return `https://disc.rgdgc.com/${path}/${id}`;
}
