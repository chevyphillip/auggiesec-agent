import { describe, expect, test } from 'bun:test';
import { buildVulnerabilitySearchQuery } from './targeted-search';
import type { OwaspCategory } from '../graph/state';

describe('Targeted Search', () => {
  describe('buildVulnerabilitySearchQuery', () => {
    test('returns specific query for Injection category', () => {
      const query = buildVulnerabilitySearchQuery('A03:2021-Injection');
      
      expect(query).toContain('SQL queries');
      expect(query).toContain('user input');
      expect(query).toContain('command execution');
    });

    test('returns specific query for Broken Access Control', () => {
      const query = buildVulnerabilitySearchQuery('A01:2021-Broken Access Control');
      
      expect(query).toContain('authorization');
      expect(query).toContain('permission');
      expect(query).toContain('access control');
    });

    test('returns specific query for Cryptographic Failures', () => {
      const query = buildVulnerabilitySearchQuery('A02:2021-Cryptographic Failures');
      
      expect(query).toContain('encryption');
      expect(query).toContain('password');
      expect(query).toContain('crypto');
    });

    test('returns specific query for Security Misconfiguration', () => {
      const query = buildVulnerabilitySearchQuery('A05:2021-Security Misconfiguration');
      
      expect(query).toContain('configuration');
      expect(query).toContain('environment variables');
      expect(query).toContain('security headers');
    });

    test('returns specific query for Vulnerable Components', () => {
      const query = buildVulnerabilitySearchQuery('A06:2021-Vulnerable and Outdated Components');
      
      expect(query).toContain('package.json');
      expect(query).toContain('dependencies');
      expect(query).toContain('npm packages');
    });

    test('returns specific query for Authentication Failures', () => {
      const query = buildVulnerabilitySearchQuery('A07:2021-Identification and Authentication Failures');
      
      expect(query).toContain('login');
      expect(query).toContain('authentication');
      expect(query).toContain('session');
    });

    test('returns specific query for Integrity Failures', () => {
      const query = buildVulnerabilitySearchQuery('A08:2021-Software and Data Integrity Failures');
      
      expect(query).toContain('serialization');
      expect(query).toContain('validation');
      expect(query).toContain('integrity');
    });

    test('returns specific query for Logging Failures', () => {
      const query = buildVulnerabilitySearchQuery('A09:2021-Security Logging and Monitoring Failures');
      
      expect(query).toContain('logging');
      expect(query).toContain('monitoring');
      expect(query).toContain('audit');
    });

    test('returns specific query for SSRF', () => {
      const query = buildVulnerabilitySearchQuery('A10:2021-Server-Side Request Forgery');
      
      expect(query).toContain('HTTP requests');
      expect(query).toContain('URL');
      expect(query).toContain('fetch');
    });

    test('returns category as fallback for unknown category', () => {
      const unknownCategory = 'A99:2021-Unknown' as OwaspCategory;
      const query = buildVulnerabilitySearchQuery(unknownCategory);
      
      expect(query).toBe(unknownCategory);
    });

    test('all queries are non-empty strings', () => {
      const categories: OwaspCategory[] = [
        'A01:2021-Broken Access Control',
        'A02:2021-Cryptographic Failures',
        'A03:2021-Injection',
        'A04:2021-Insecure Design',
        'A05:2021-Security Misconfiguration',
        'A06:2021-Vulnerable and Outdated Components',
        'A07:2021-Identification and Authentication Failures',
        'A08:2021-Software and Data Integrity Failures',
        'A09:2021-Security Logging and Monitoring Failures',
        'A10:2021-Server-Side Request Forgery',
      ];

      for (const category of categories) {
        const query = buildVulnerabilitySearchQuery(category);
        expect(query.length).toBeGreaterThan(0);
        expect(typeof query).toBe('string');
      }
    });
  });
});

