import {getScratchProjectIdFromUrl} from '../../../src/lib/scratch-project-url';

describe('getScratchProjectIdFromUrl', () => {
    test('extracts project ids from Scratch project page URLs', () => {
        expect(getScratchProjectIdFromUrl('https://scratch.mit.edu/projects/123456/')).toBe('123456');
        expect(getScratchProjectIdFromUrl('https://www.scratch.mit.edu/projects/123456/editor/')).toBe('123456');
    });

    test('returns null for direct project archives and unrelated URLs', () => {
        expect(getScratchProjectIdFromUrl('https://projects.scratch.mit.edu/123456')).toBeNull();
        expect(getScratchProjectIdFromUrl('https://example.com/projects/123456/')).toBeNull();
    });
});
