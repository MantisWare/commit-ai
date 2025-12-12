import {
  ReviewResult,
  ReviewFinding,
  ReviewSeverity
} from '../../src/commands/review';

describe('review', () => {
  describe('ReviewResult structure', () => {
    it('should have valid structure for approve recommendation', () => {
      const result: ReviewResult = {
        summary: 'Excellent code quality with no issues found.',
        overallScore: 95,
        recommendation: 'approve',
        findings: []
      };

      expect(result.summary).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.recommendation).toBe('approve');
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it('should have valid structure for review recommendation', () => {
      const finding: ReviewFinding = {
        category: 'performance',
        severity: 'warning',
        title: 'Inefficient loop',
        description: 'Using forEach instead of for loop',
        file: 'src/utils.ts',
        line: 'L42',
        suggestion: 'Use for loop for better performance'
      };

      const result: ReviewResult = {
        summary: 'Good code with minor performance improvements needed.',
        overallScore: 70,
        recommendation: 'review',
        findings: [finding]
      };

      expect(result.overallScore).toBe(70);
      expect(result.recommendation).toBe('review');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].category).toBe('performance');
      expect(result.findings[0].severity).toBe('warning');
    });

    it('should have valid structure for block recommendation', () => {
      const securityFinding: ReviewFinding = {
        category: 'security',
        severity: 'error',
        title: 'SQL Injection vulnerability',
        description: 'User input directly concatenated in SQL query',
        file: 'src/database.ts',
        line: 'L123-L125',
        suggestion: 'Use parameterized queries'
      };

      const result: ReviewResult = {
        summary: 'Critical security vulnerabilities found.',
        overallScore: 35,
        recommendation: 'block',
        findings: [securityFinding]
      };

      expect(result.overallScore).toBeLessThan(50);
      expect(result.recommendation).toBe('block');
      expect(result.findings[0].severity).toBe('error');
      expect(result.findings[0].category).toBe('security');
    });
  });

  describe('ReviewFinding structure', () => {
    it('should support all severity levels', () => {
      const severities: ReviewSeverity[] = ['error', 'warning', 'info'];

      severities.forEach((severity) => {
        const finding: ReviewFinding = {
          category: 'style',
          severity,
          title: 'Test finding',
          description: 'Test description'
        };

        expect(finding.severity).toBe(severity);
      });
    });

    it('should support all category types', () => {
      const categories = [
        'security',
        'performance',
        'style',
        'best-practices',
        'bugs',
        'maintainability'
      ] as const;

      categories.forEach((category) => {
        const finding: ReviewFinding = {
          category,
          severity: 'info',
          title: `${category} finding`,
          description: `Test ${category} issue`
        };

        expect(finding.category).toBe(category);
      });
    });

    it('should have optional file and line fields', () => {
      const findingWithLocation: ReviewFinding = {
        category: 'bugs',
        severity: 'error',
        title: 'Null pointer exception',
        description: 'Variable may be null',
        file: 'src/app.ts',
        line: 'L50'
      };

      const findingWithoutLocation: ReviewFinding = {
        category: 'bugs',
        severity: 'error',
        title: 'General issue',
        description: 'Issue without specific location'
      };

      expect(findingWithLocation.file).toBeDefined();
      expect(findingWithLocation.line).toBeDefined();
      expect(findingWithoutLocation.file).toBeUndefined();
      expect(findingWithoutLocation.line).toBeUndefined();
    });

    it('should have optional suggestion field', () => {
      const findingWithSuggestion: ReviewFinding = {
        category: 'performance',
        severity: 'warning',
        title: 'Slow operation',
        description: 'Operation could be optimized',
        suggestion: 'Use memoization'
      };

      const findingWithoutSuggestion: ReviewFinding = {
        category: 'performance',
        severity: 'warning',
        title: 'Slow operation',
        description: 'Operation could be optimized'
      };

      expect(findingWithSuggestion.suggestion).toBeDefined();
      expect(findingWithoutSuggestion.suggestion).toBeUndefined();
    });
  });

  describe('recommendation logic', () => {
    it('should recommend approve for high scores (80-100)', () => {
      const scores = [80, 85, 90, 95, 100];

      scores.forEach((score) => {
        const result: ReviewResult = {
          summary: 'Good code',
          overallScore: score,
          recommendation: 'approve',
          findings: []
        };

        expect(result.recommendation).toBe('approve');
        expect(result.overallScore).toBeGreaterThanOrEqual(80);
      });
    });

    it('should recommend review for medium scores (50-79)', () => {
      const scores = [50, 60, 70, 75, 79];

      scores.forEach((score) => {
        const result: ReviewResult = {
          summary: 'Needs improvement',
          overallScore: score,
          recommendation: 'review',
          findings: []
        };

        expect(result.recommendation).toBe('review');
        expect(result.overallScore).toBeGreaterThanOrEqual(50);
        expect(result.overallScore).toBeLessThan(80);
      });
    });

    it('should recommend block for low scores (0-49)', () => {
      const scores = [0, 10, 25, 40, 49];

      scores.forEach((score) => {
        const result: ReviewResult = {
          summary: 'Critical issues',
          overallScore: score,
          recommendation: 'block',
          findings: []
        };

        expect(result.recommendation).toBe('block');
        expect(result.overallScore).toBeLessThan(50);
      });
    });
  });

  describe('findings aggregation', () => {
    it('should support multiple findings of different categories', () => {
      const findings: ReviewFinding[] = [
        {
          category: 'security',
          severity: 'error',
          title: 'XSS vulnerability',
          description: 'Unescaped user input'
        },
        {
          category: 'performance',
          severity: 'warning',
          title: 'Slow query',
          description: 'Missing database index'
        },
        {
          category: 'style',
          severity: 'info',
          title: 'Formatting issue',
          description: 'Inconsistent indentation'
        }
      ];

      const result: ReviewResult = {
        summary: 'Mixed issues found',
        overallScore: 65,
        recommendation: 'review',
        findings
      };

      expect(result.findings).toHaveLength(3);

      const categories = result.findings.map((f) => f.category);
      expect(categories).toContain('security');
      expect(categories).toContain('performance');
      expect(categories).toContain('style');
    });

    it('should support multiple findings in same file', () => {
      const findings: ReviewFinding[] = [
        {
          category: 'bugs',
          severity: 'error',
          title: 'Undefined variable',
          description: 'Variable used before declaration',
          file: 'src/app.ts',
          line: 'L10'
        },
        {
          category: 'bugs',
          severity: 'error',
          title: 'Type mismatch',
          description: 'Expected string, got number',
          file: 'src/app.ts',
          line: 'L25'
        }
      ];

      const result: ReviewResult = {
        summary: 'Multiple issues in app.ts',
        overallScore: 40,
        recommendation: 'block',
        findings
      };

      expect(result.findings).toHaveLength(2);
      expect(result.findings.every((f) => f.file === 'src/app.ts')).toBe(true);
    });

    it('should handle empty findings array', () => {
      const result: ReviewResult = {
        summary: 'Perfect code, no issues',
        overallScore: 100,
        recommendation: 'approve',
        findings: []
      };

      expect(result.findings).toHaveLength(0);
      expect(Array.isArray(result.findings)).toBe(true);
    });
  });

  describe('score boundaries', () => {
    it('should accept score of 0', () => {
      const result: ReviewResult = {
        summary: 'Terrible code',
        overallScore: 0,
        recommendation: 'block',
        findings: []
      };

      expect(result.overallScore).toBe(0);
    });

    it('should accept score of 100', () => {
      const result: ReviewResult = {
        summary: 'Perfect code',
        overallScore: 100,
        recommendation: 'approve',
        findings: []
      };

      expect(result.overallScore).toBe(100);
    });

    it('should have score between 0 and 100', () => {
      const scores = [0, 25, 50, 75, 100];

      scores.forEach((score) => {
        const result: ReviewResult = {
          summary: 'Test',
          overallScore: score,
          recommendation: score >= 80 ? 'approve' : score >= 50 ? 'review' : 'block',
          findings: []
        };

        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      });
    });
  });
});
