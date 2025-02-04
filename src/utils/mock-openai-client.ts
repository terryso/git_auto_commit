import OpenAI from 'openai';
import sinon from 'sinon';

let mockError: Error | null = null;

export const setMockError = (error: Error) => {
    mockError = error;
};

// Mock OpenAI client
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: sinon.stub().callsFake(async () => {
        if (mockError) {
          throw mockError;
        }
        return {
          choices: [
            {
              message: {
                content: 'feat: add new feature'
              }
            }
          ]
        };
      })
    }
  }
} as unknown as OpenAI; 