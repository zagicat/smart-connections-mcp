/**
 * Loader for Smart Connections data from .smart-env directory
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SmartSource, SmartEnvConfig } from './types.js';

export class SmartConnectionsLoader {
  private vaultPath: string;
  private smartEnvPath: string;
  private config: SmartEnvConfig | null = null;
  private sources: Map<string, SmartSource> = new Map();

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.smartEnvPath = path.join(vaultPath, '.smart-env');
  }

  /**
   * Initialize and load all Smart Connections data
   */
  async initialize(): Promise<void> {
    // Check if .smart-env exists
    if (!fs.existsSync(this.smartEnvPath)) {
      throw new Error(`Smart Connections directory not found at: ${this.smartEnvPath}`);
    }

    // Load configuration
    await this.loadConfig();

    // Load all sources
    await this.loadSources();
  }

  /**
   * Load smart_env.json configuration
   */
  private async loadConfig(): Promise<void> {
    const configPath = path.join(this.smartEnvPath, 'smart_env.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at: ${configPath}`);
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(configData);
  }

  /**
   * Load all .ajson files from the multi directory
   */
  private async loadSources(): Promise<void> {
    const multiPath = path.join(this.smartEnvPath, 'multi');

    if (!fs.existsSync(multiPath)) {
      throw new Error(`Multi directory not found at: ${multiPath}`);
    }

    const files = fs.readdirSync(multiPath);
    const ajsonFiles = files.filter(f => f.endsWith('.ajson'));

    console.error(`Loading ${ajsonFiles.length} source files...`);

    for (const file of ajsonFiles) {
      try {
        const filePath = path.join(multiPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse the AJSON format (JSONL - one JSON object per line)
        // Each line is a single object like: "key": {...}
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            // Each line is formatted as: "key1": {...}, "key2": {...}, "key3": {...},
            // Remove trailing comma and wrap with curly braces to make valid JSON
            const cleanedLine = line.replace(/,\s*$/, '');
            const obj = JSON.parse(`{${cleanedLine}}`);

            // Process all key-value pairs in the object
            for (const key of Object.keys(obj)) {
              // Only process smart_sources entries (not smart_blocks)
              if (key.startsWith('smart_sources:')) {
                const sourceData: SmartSource = obj[key];
                // Skip entries with null/undefined paths
                if (sourceData && sourceData.path) {
                  this.sources.set(sourceData.path, sourceData);
                }
              }
            }
          } catch (parseError) {
            // Skip lines that can't be parsed
            console.error(`Parse error in ${file}:`, parseError);
          }
        }
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }

    console.error(`Loaded ${this.sources.size} sources successfully`);
  }

  /**
   * Get all sources
   */
  getSources(): Map<string, SmartSource> {
    return this.sources;
  }

  /**
   * Normalize a path for comparison by applying NFC Unicode normalization.
   * This handles filenames with curly quotes, smart apostrophes, narrow
   * no-break spaces, and other Unicode variants that may differ between
   * what the caller provides and what is stored in the index.
   */
  private normalizePath(p: string): string {
    return p.normalize('NFC');
  }

  /**
   * Get a specific source by path.
   * Falls back to a normalized comparison if the exact key is not found,
   * so that paths with smart quotes or other Unicode variants still resolve.
   */
  getSource(notePath: string): SmartSource | undefined {
    // Fast path: exact match
    const exact = this.sources.get(notePath);
    if (exact !== undefined) return exact;

    // Fallback: compare normalized forms
    const normalizedInput = this.normalizePath(notePath);
    for (const [key, source] of this.sources) {
      if (this.normalizePath(key) === normalizedInput) {
        return source;
      }
    }

    return undefined;
  }

  /**
   * Get configuration
   */
  getConfig(): SmartEnvConfig | null {
    return this.config;
  }

  /**
   * Get the embedding model key from config
   */
  getEmbeddingModelKey(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Extract the model key from the embed_model configuration
    const embedModel = this.config.smart_sources.embed_model;
    const adapter = embedModel.adapter;

    // The actual model key is nested in the adapter configuration
    // e.g., embed_model.transformers.model_key = "TaylorAI/bge-micro-v2"
    if (adapter && embedModel[adapter] && typeof embedModel[adapter] === 'object') {
      const adapterConfig = embedModel[adapter] as any;
      if (adapterConfig.model_key) {
        return adapterConfig.model_key;
      }
    }

    // Fallback: find first object key that's not 'adapter'
    const modelKeys = Object.keys(embedModel).filter(k => k !== 'adapter' && typeof embedModel[k] === 'object');

    if (modelKeys.length === 0) {
      throw new Error('No embedding model found in configuration');
    }

    return modelKeys[0];
  }

  /**
   * Get vault path
   */
  getVaultPath(): string {
    return this.vaultPath;
  }

  /**
   * Read the actual markdown content of a note.
   * Falls back to a normalized path comparison when the exact path does not
   * exist on disk, handling filenames with smart quotes or other Unicode
   * variants that differ between the index and the filesystem.
   */
  readNoteContent(notePath: string): string {
    const fullPath = path.join(this.vaultPath, notePath);

    // Fast path: exact path exists
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8');
    }

    // Fallback: scan the parent directory for a file whose NFC-normalized
    // name matches the NFC-normalized form of the requested filename.
    const dir = path.dirname(fullPath);
    const basename = path.basename(fullPath);
    const normalizedBasename = basename.normalize('NFC');

    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir);
      const match = entries.find(e => e.normalize('NFC') === normalizedBasename);
      if (match) {
        return fs.readFileSync(path.join(dir, match), 'utf-8');
      }
    }

    throw new Error(`Note not found at: ${fullPath}`);
  }

  /**
   * Extract content for specific blocks/sections
   */
  extractBlockContent(notePath: string, blockHeading: string): string {
    const content = this.readNoteContent(notePath);
    const source = this.getSource(notePath);

    if (!source || !source.blocks[blockHeading]) {
      return '';
    }

    const [startLine, endLine] = source.blocks[blockHeading];
    const lines = content.split('\n');

    return lines.slice(startLine - 1, endLine).join('\n');
  }
}
