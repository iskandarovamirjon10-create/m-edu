import { describe, it, expect } from 'vitest';
import { extractUzbekEntityCandidates, stemUzbekWord, normalizeUzbekText } from '../uzbek-nlp.util';

describe('Uzbek NLP Utilities for AI Copilot', () => {
  describe('normalizeUzbekText', () => {
    it('normalizes various types of apostrophes into standard single quote', () => {
      expect(normalizeUzbekText("O‘quvchilar ko`rsatkichlari")).toBe("o'quvchilar ko'rsatkichlari");
      expect(normalizeUzbekText("Ta’lim sifatining tahlili")).toBe("ta'lim sifatining tahlili");
    });
  });

  describe('stemUzbekWord', () => {
    it('strips case suffixes accurately', () => {
      expect(stemUzbekWord('Rustamning')).toContain('Rustam');
      expect(stemUzbekWord('Rustamga')).toContain('Rustam');
      expect(stemUzbekWord('Rustamda')).toContain('Rustam');
      expect(stemUzbekWord('Rustamdan')).toContain('Rustam');
      expect(stemUzbekWord('Rustamni')).toContain('Rustam');
    });

    it('strips affectionate/honorific suffixes (-jon, -bek, -xon)', () => {
      expect(stemUzbekWord('Rustamjon')).toContain('Rustam');
      expect(stemUzbekWord('Azizbek')).toContain('Aziz');
      expect(stemUzbekWord('Dilnozaxon')).toContain('Dilnoza');
      expect(stemUzbekWord('Rustamjonning')).toContain('Rustam');
    });

    it('strips possessive and plural suffixes', () => {
      expect(stemUzbekWord('Frontend-01dagilar')).toContain('Frontend-01');
      expect(stemUzbekWord('darslari')).toContain('dars');
      expect(stemUzbekWord('guruhi')).toContain('guruh');
      expect(stemUzbekWord('o\'quvchisining')).toContain("o'quvchi");
    });

    it('keeps short words intact to avoid over-stemming', () => {
      expect(stemUzbekWord('Ali')).toEqual(['Ali']);
      expect(stemUzbekWord('Bob')).toEqual(['Bob']);
    });
  });

  describe('extractUzbekEntityCandidates', () => {
    it('extracts proper candidate names and pairs from natural queries', () => {
      const candidates = extractUzbekEntityCandidates("Rustam Sharipovning bugungi davomati qanday?");
      
      // Should find individual stems
      expect(candidates.singleTokens).toContain('Rustam');
      expect(candidates.singleTokens).toContain('Sharipov');
      
      // Should pair first and last names together
      expect(candidates.namePairs).toEqual(
        expect.arrayContaining([{ first: 'Rustam', last: 'Sharipov' }])
      );
    });

    it('extracts group and course names without stopwords', () => {
      const candidates = extractUzbekEntityCandidates("Frontend-01 guruhidagi qarzdorlarni ko'rsat");
      expect(candidates.singleTokens).toContain('Frontend-01');
      expect(candidates.singleTokens).not.toContain('ko\'rsat');
      expect(candidates.singleTokens).not.toContain('qarzdorlarni');
    });

    it('handles Russian queries gracefully', () => {
      const candidates = extractUzbekEntityCandidates("Какая посещаемость у Рустама Шарипова?");
      expect(candidates.singleTokens).toContain('Рустама');
      expect(candidates.singleTokens).toContain('Шарипова');
    });
  });
});
