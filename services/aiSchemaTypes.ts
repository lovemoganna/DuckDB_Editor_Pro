/**
 * Type definitions for AI Schema
 * Corresponds to structure generated in aiSchema.ts
 */

export interface AISchemaBlock {
    [key: string]: string;
}

export interface AIModule {
    id: string;
    title: string;
    blocks: AISchemaBlock;
    fullContent: string;
}

export interface AISchema {
    modules: {
        [key: string]: AIModule;
    };
    skills: {
        [key: string]: AIModule;
    };
}
