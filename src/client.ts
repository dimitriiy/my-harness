import Anthropic from '@anthropic-ai/sdk';
import './config';

// Anthropic SDK auto-reads ANTHROPIC_API_KEY from process.env
export const client = new Anthropic();
