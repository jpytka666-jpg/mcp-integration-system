/**
 * Response style configuration parser and tone matching system
 */

import { ResponseStyleConfig } from './types';

export interface UserInputStyle {
  tone: 'formal' | 'casual' | 'technical' | 'friendly';
  complexity: 'simple' | 'moderate' | 'complex';
  urgency: 'low' | 'medium' | 'high';
  questionType: 'help' | 'debug' | 'implement' | 'explain';
}

export interface ToneMatchingRules {
  formalIndicators: string[];
  casualIndicators: string[];
  technicalIndicators: string[];
  friendlyIndicators: string[];
  urgencyIndicators: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

export class ResponseStyleParser {
  private toneRules: ToneMatchingRules;

  constructor() {
    this.toneRules = {
      formalIndicators: [
        'please', 'could you', 'would you', 'kindly', 'sir', 'madam',
        'thank you', 'appreciate', 'request', 'require'
      ],
      casualIndicators: [
        'hey', 'hi', 'yo', 'sup', 'cool', 'awesome', 'nice', 'sweet',
        'dude', 'man', 'bro', 'lol', 'haha', 'yeah', 'yep', 'nah'
      ],
      technicalIndicators: [
        'function', 'class', 'method', 'variable', 'algorithm', 'implementation',
        'architecture', 'design pattern', 'api', 'database', 'framework',
        'library', 'dependency', 'compile', 'debug', 'refactor'
      ],
      friendlyIndicators: [
        'help', 'thanks', 'appreciate', 'love', 'great', 'wonderful',
        'amazing', 'fantastic', 'excited', 'looking forward'
      ],
      urgencyIndicators: {
        high: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'broken', 'failing', 'error'],
        medium: ['soon', 'today', 'quick', 'fast', 'need', 'important'],
        low: ['when you have time', 'no rush', 'eventually', 'sometime', 'later', 'when you can']
      }
    };
  }

  /**
   * Analyzes user input to detect communication style
   */
  detectUserStyle(input: string): UserInputStyle {
    const lowerInput = input.toLowerCase();
    const words = lowerInput.split(/\s+/);

    const tone = this.detectTone(lowerInput, words);
    const complexity = this.detectComplexity(input, words);
    const urgency = this.detectUrgency(lowerInput, words);
    const questionType = this.detectQuestionType(lowerInput, words);

    return { tone, complexity, urgency, questionType };
  }

  /**
   * Matches response style to user input style
   */
  matchResponseStyle(userStyle: UserInputStyle, baseConfig: ResponseStyleConfig): ResponseStyleConfig {
    let tone: ResponseStyleConfig['tone'] = baseConfig.tone;
    let verbosity: ResponseStyleConfig['verbosity'] = baseConfig.verbosity;

    // Adjust tone based on user style
    if (userStyle.tone === 'formal') {
      tone = 'professional';
    } else if (userStyle.tone === 'casual' || userStyle.tone === 'friendly') {
      tone = 'warm';
    } else if (userStyle.tone === 'technical') {
      tone = 'professional';
    }

    // Adjust verbosity based on complexity and urgency
    if (userStyle.complexity === 'simple' || userStyle.urgency === 'high') {
      verbosity = 'minimal';
    } else if (userStyle.complexity === 'complex') {
      verbosity = 'detailed';
    }

    return {
      ...baseConfig,
      tone,
      verbosity
    };
  }

  private detectTone(lowerInput: string, words: string[]): UserInputStyle['tone'] {
    const scores = {
      formal: this.calculateScore(words, this.toneRules.formalIndicators),
      casual: this.calculateScore(words, this.toneRules.casualIndicators),
      technical: this.calculateScore(words, this.toneRules.technicalIndicators),
      friendly: this.calculateScore(words, this.toneRules.friendlyIndicators)
    };

    // If no indicators found, default to technical for implementation-related content
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      if (lowerInput.includes('implement') || lowerInput.includes('code') || lowerInput.includes('function')) {
        return 'technical';
      }
      return 'friendly';
    }

    return this.getHighestScore(scores) as UserInputStyle['tone'];
  }

  private detectComplexity(input: string, words: string[]): UserInputStyle['complexity'] {
    const sentenceCount = input.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = words.length / Math.max(sentenceCount, 1);
    const technicalTerms = this.calculateScore(words, this.toneRules.technicalIndicators);

    if (avgWordsPerSentence > 15 || technicalTerms > 3 || sentenceCount > 2) {
      return 'complex';
    } else if (avgWordsPerSentence > 8 || technicalTerms > 0 || sentenceCount > 1) {
      return 'moderate';
    }
    return 'simple';
  }

  private detectUrgency(lowerInput: string, words: string[]): UserInputStyle['urgency'] {
    // Check for phrase matches first
    for (const phrase of this.toneRules.urgencyIndicators.high) {
      if (lowerInput.includes(phrase)) return 'high';
    }
    for (const phrase of this.toneRules.urgencyIndicators.low) {
      if (lowerInput.includes(phrase)) return 'low';
    }
    for (const phrase of this.toneRules.urgencyIndicators.medium) {
      if (lowerInput.includes(phrase)) return 'medium';
    }
    
    // Default based on punctuation and caps
    if (lowerInput.includes('!') || /[A-Z]{2,}/.test(lowerInput)) {
      return 'high';
    }
    
    return 'medium';
  }

  private detectQuestionType(lowerInput: string, words: string[]): UserInputStyle['questionType'] {
    if (lowerInput.includes('help') || lowerInput.includes('how')) {
      return 'help';
    }
    if (lowerInput.includes('error') || lowerInput.includes('bug') || lowerInput.includes('debug')) {
      return 'debug';
    }
    if (lowerInput.includes('implement') || lowerInput.includes('create') || lowerInput.includes('build')) {
      return 'implement';
    }
    if (lowerInput.includes('what') || lowerInput.includes('why') || lowerInput.includes('explain')) {
      return 'explain';
    }
    return 'help';
  }

  private calculateScore(words: string[], indicators: string[]): number {
    return words.reduce((score, word) => {
      return score + (indicators.includes(word) ? 1 : 0);
    }, 0);
  }

  private getHighestScore(scores: Record<string, number>): string {
    const maxScore = Math.max(...Object.values(scores));
    const winners = Object.entries(scores).filter(([_, score]) => score === maxScore);
    
    // If there's a tie, prioritize in order: formal, technical, friendly, casual
    const priority = ['formal', 'technical', 'friendly', 'casual'];
    for (const tone of priority) {
      if (winners.some(([name]) => name === tone)) {
        return tone;
      }
    }
    
    return winners[0][0];
  }
}