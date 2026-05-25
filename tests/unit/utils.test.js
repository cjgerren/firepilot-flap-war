/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { cn } from '../../src/lib/utils.js';

describe('utils', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('p-2', 'text-white', 'p-4')).toBe('text-white p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', null, undefined, 'active')).toBe('base active');
  });
});
