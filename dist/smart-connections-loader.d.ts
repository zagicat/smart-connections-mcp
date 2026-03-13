/**
 * Loader for Smart Connections data from .smart-env directory
 */
import type { SmartSource, SmartEnvConfig } from './types.js';
export declare class SmartConnectionsLoader {
    private vaultPath;
    private smartEnvPath;
    private config;
    private sources;
    constructor(vaultPath: string);
    /**
     * Initialize and load all Smart Connections data
     */
    initialize(): Promise<void>;
    /**
     * Load smart_env.json configuration
     */
    private loadConfig;
    /**
     * Load all .ajson files from the multi directory
     */
    private loadSources;
    /**
     * Get all sources
     */
    getSources(): Map<string, SmartSource>;
    /**
     * Normalize a path for comparison by applying NFC Unicode normalization.
     * This handles filenames with curly quotes, smart apostrophes, narrow
     * no-break spaces, and other Unicode variants that may differ between
     * what the caller provides and what is stored in the index.
     */
    private normalizePath;
    /**
     * Get a specific source by path.
     * Falls back to a normalized comparison if the exact key is not found,
     * so that paths with smart quotes or other Unicode variants still resolve.
     */
    getSource(notePath: string): SmartSource | undefined;
    /**
     * Get configuration
     */
    getConfig(): SmartEnvConfig | null;
    /**
     * Get the embedding model key from config
     */
    getEmbeddingModelKey(): string;
    /**
     * Get vault path
     */
    getVaultPath(): string;
    /**
     * Read the actual markdown content of a note.
     * Falls back to a normalized path comparison when the exact path does not
     * exist on disk, handling filenames with smart quotes or other Unicode
     * variants that differ between the index and the filesystem.
     */
    readNoteContent(notePath: string): string;
    /**
     * Extract content for specific blocks/sections
     */
    extractBlockContent(notePath: string, blockHeading: string): string;
}
//# sourceMappingURL=smart-connections-loader.d.ts.map