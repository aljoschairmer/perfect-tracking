/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Raster tile template for the live map. Defaults to OpenStreetMap; override
   * it to use another provider, or to point at a proxy on networks that can't
   * reach tile.openstreetmap.org directly.
   */
  readonly VITE_TILE_URL?: string;
  /** Attribution HTML shown on the map, if the tile source is overridden. */
  readonly VITE_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
