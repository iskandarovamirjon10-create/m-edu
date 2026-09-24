import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto, ToggleAutomationRuleDto } from '../dto/automation.dto';

describe('Automation DTOs validation', () => {
  it('validates a correct CreateAutomationRuleDto', async () => {
    const plain = {
      name: 'Test Rule',
      eventType: 'STUDENT_ABSENT',
      actions: [{ type: 'IN_APP_NOTIFICATION', template: 'test' }],
      conditions: [{ field: 'daysBack', operator: 'gte', value: 7 }],
      cooldownMinutes: 30,
      maxTriggersPerDay: 100,
    };
    const dto = plainToInstance(CreateAutomationRuleDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid cooldownMinutes (< 1)', async () => {
    const plain = {
      name: 'Test Rule',
      eventType: 'STUDENT_ABSENT',
      actions: [{ type: 'IN_APP_NOTIFICATION' }],
      cooldownMinutes: 0,
    };
    const dto = plainToInstance(CreateAutomationRuleDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validates UpdateAutomationRuleDto', async () => {
    const plain = { name: 'Updated Rule' };
    const dto = plainToInstance(UpdateAutomationRuleDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates ToggleAutomationRuleDto', async () => {
    const plain = { isActive: true };
    const dto = plainToInstance(ToggleAutomationRuleDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const invalidPlain = { isActive: 'not-a-bool' };
    const invalidDto = plainToInstance(ToggleAutomationRuleDto, invalidPlain);
    const invalidErrors = await validate(invalidDto);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});
