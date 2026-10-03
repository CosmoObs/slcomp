// Symbolic Earth -> sky mapping, not an astronomical coordinate conversion.
// McComb, MS: 31°14′37.6″ N, 90°27′11.4″ W (Wikidata Q846178).
// Birthplace: https://www.explorelouisiana.com/music/britney-spears
// Coordinates: https://www.wikidata.org/wiki/Q846178
// Treat latitude as DEC and longitude modulo 360 as RA, then use the same
// RA-left Mollweide projection as the catalog. Never insert this into data.
export const SURPRISE_LOCATION = {
  RA: (360 - (90 + 27 / 60 + 11.4 / 3600)) % 360,
  DEC: 31 + 14 / 60 + 37.6 / 3600
};
