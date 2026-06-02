import { getSynthesisPrompt } from '../../src/prompts';

describe('getSynthesisPrompt', () => {
  it('builds system and user messages from chunk summaries', () => {
    const messages = getSynthesisPrompt(
      ['feat(api): add endpoint', 'fix(ui): button color'],
      false,
      'release prep'
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[0].content).toContain('ONE final commit message');
    expect(messages[1].content).toContain('1. feat(api): add endpoint');
    expect(messages[1].content).toContain('2. fix(ui): button color');
    expect(messages[0].content).toContain('release prep');
  });
});
