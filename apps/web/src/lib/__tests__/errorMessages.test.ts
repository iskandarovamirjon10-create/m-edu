import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../errorMessages';
import { ApiError } from '../api';

describe('getErrorMessage', () => {
  it('returns the friendly face message when an ApiError carries a domain code', () => {
    const err = new ApiError(409, 'raw technical enrollment message', { code: 'ENROLLMENT_ALREADY_EXISTS' });
    expect(getErrorMessage(err)).toContain('already has an active enrollment');
  });

  it('returns the sanitized ApiError message when no domain code is present', () => {
    const err = new ApiError(401, 'Invalid credentials');
    expect(getErrorMessage(err)).toBe('Invalid credentials');
  });

  it('passes through regular Error messages', () => {
    expect(getErrorMessage(new Error('Network request failed'))).toBe('Network request failed');
  });

  it('returns a generic fallback for unknown thrown values', () => {
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(42)).toBe('Something went wrong. Please try again.');
  });

  it('falls back to the message when the domain code is unknown', () => {
    const err = new ApiError(500, 'Internal server error', { code: 'SOME_UNKNOWN_CODE' });
    expect(getErrorMessage(err)).toBe('Internal server error');
  });

  it('translates STUDENT_NOT_ENROLLED_IN_GROUP with student and group names across 3 languages', () => {
    const err = new ApiError(400, 'Student is not enrolled in group', {
      code: 'STUDENT_NOT_ENROLLED_IN_GROUP',
      studentName: 'Ali Valiyev',
      groupName: 'Frontend Bootcamp',
    });

    expect(getErrorMessage(err, 'uz')).toBe('"Ali Valiyev" o‘quvchisi "Frontend Bootcamp" guruhiga a’zo emas. Iltimos, o‘quvchini avval guruhga biriktiring.');
    expect(getErrorMessage(err, 'ru')).toBe('Ученик "Ali Valiyev" не зачислен в группу "Frontend Bootcamp". Сначала добавьте ученика в эту группу.');
    expect(getErrorMessage(err, 'en')).toBe('Student "Ali Valiyev" is not enrolled in group "Frontend Bootcamp". Please enroll the student in this group first.');
  });

  it('translates raw developer error containing UUIDs without leaking UUIDs to user', () => {
    const rawUuidError = new Error('Student 4542f7a2-d700-4c17-a3fe-52128baa876f is not enrolled in group 27c1d6ef-4390-44b5-b0fb-9524931e1343');

    const msgUz = getErrorMessage(rawUuidError, 'uz');
    const msgRu = getErrorMessage(rawUuidError, 'ru');
    const msgEn = getErrorMessage(rawUuidError, 'en');

    expect(msgUz).toBe('O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, o‘quvchini avval guruhga biriktiring.');
    expect(msgRu).toBe('Ученик не зачислен в эту группу. Пожалуйста, добавьте ученика в группу.');
    expect(msgEn).toBe('Student is not enrolled in this group. Please enroll the student in this group first.');

    expect(msgUz).not.toMatch(/[a-f0-9-]{36}/);
    expect(msgRu).not.toMatch(/[a-f0-9-]{36}/);
    expect(msgEn).not.toMatch(/[a-f0-9-]{36}/);
  });

  it('translates lesson and enrollment domain codes', () => {
    const lessonNotFound = new ApiError(404, 'Lesson not found', { code: 'LESSON_NOT_FOUND' });
    expect(getErrorMessage(lessonNotFound, 'uz')).toBe('Dars topilmadi.');
    expect(getErrorMessage(lessonNotFound, 'ru')).toBe('Урок не найден.');
    expect(getErrorMessage(lessonNotFound, 'en')).toBe('Lesson not found.');

    const mismatch = new ApiError(400, 'Lesson mismatch', { code: 'LESSON_GROUP_MISMATCH' });
    expect(getErrorMessage(mismatch, 'uz')).toBe('Dars tanlangan guruhga tegishli emas.');
    expect(getErrorMessage(mismatch, 'ru')).toBe('Урок не принадлежит выбранной группе.');
    expect(getErrorMessage(mismatch, 'en')).toBe('Lesson does not belong to the selected group.');
  });
});
