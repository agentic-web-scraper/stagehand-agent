'use strict';

import OpenAI from 'openai';

/**
 * Wrapper that makes NVIDIA NIM API compatible with OpenAI's interface
 * Handles response cleaning and format conversion for Stagehand agent mode
 */
export class NvidiaOpenAIWrapper {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model || 'meta/llama-3.1-8b-instruct';
    
    // Create underlying OpenAI client
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });
  }

  /**
   * Clean NVIDIA NIM responses that include JSON schema + data
   */
  _cleanResponse(content) {
    if (!content) return content;
    
    // NVIDIA NIM sometimes returns: schema\n\ndata
    // Extract just the data part (last JSON object)
    const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (jsonMatches && jsonMatches.length > 1) {
      return jsonMatches[jsonMatches.length - 1];
    }
    
    return content;
  }

  /**
   * Wrap chat.completions.create to clean responses
   */
  get chat() {
    const self = this;
    
    return {
      completions: {
        create: async (params) => {
          // Use the configured model if not specified
          if (!params.model) {
            params.model = self.model;
          }
          
          // Call NVIDIA NIM API
          const response = await self.client.chat.completions.create(params);
          
          // Clean the response content
          if (response.choices?.[0]?.message?.content) {
            const cleaned = self._cleanResponse(response.choices[0].message.content);
            response.choices[0].message.content = cleaned;
          }
          
          return response;
        }
      }
    };
  }

  /**
   * Expose other OpenAI client methods if needed
   */
  get models() {
    return this.client.models;
  }

  get embeddings() {
    return this.client.embeddings;
  }

  get images() {
    return this.client.images;
  }

  get audio() {
    return this.client.audio;
  }

  get files() {
    return this.client.files;
  }

  get fineTuning() {
    return this.client.fineTuning;
  }

  get moderations() {
    return this.client.moderations;
  }

  /**
   * Static factory method for easy creation
   */
  static create(config) {
    return new NvidiaOpenAIWrapper(config);
  }
}

export default NvidiaOpenAIWrapper;
