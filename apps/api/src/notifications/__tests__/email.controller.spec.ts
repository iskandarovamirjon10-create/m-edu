import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailController } from '../email.controller';
import { EmailService } from '../email.service';

describe('EmailController', () => {
  let controller: EmailController;
  let service: EmailService;

  const mockTemplate = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    name: 'Welcome',
    subject: 'Welcome to M-EDU',
    htmlBody: '<p>Welcome!</p>',
  };

  beforeEach(() => {
    service = {
      createTemplate: vi.fn().mockResolvedValue(mockTemplate),
      getTemplates: vi.fn().mockResolvedValue([mockTemplate]),
      getTemplateById: vi.fn().mockResolvedValue(mockTemplate),
      updateTemplate: vi.fn().mockResolvedValue(mockTemplate),
      deleteTemplate: vi.fn().mockResolvedValue(mockTemplate),
      sendTemplatedEmail: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as EmailService;

    controller = new EmailController(service);
  });

  it('should create an email template', async () => {
    const dto = { name: 'Welcome', subject: 'Welcome', htmlBody: '<p>Hi</p>' };
    const result = await controller.createTemplate('org-1', dto);
    expect(result).toEqual(mockTemplate);
    expect(service.createTemplate).toHaveBeenCalledWith('org-1', dto);
  });

  it('should list email templates', async () => {
    const result = await controller.getTemplates('org-1');
    expect(result).toEqual([mockTemplate]);
    expect(service.getTemplates).toHaveBeenCalledWith('org-1');
  });

  it('should get email template by id', async () => {
    const result = await controller.getTemplateById('org-1', mockTemplate.id);
    expect(result).toEqual(mockTemplate);
    expect(service.getTemplateById).toHaveBeenCalledWith('org-1', mockTemplate.id);
  });

  it('should update email template', async () => {
    const dto = { subject: 'New Subject' };
    const result = await controller.updateTemplate('org-1', mockTemplate.id, dto);
    expect(result).toEqual(mockTemplate);
    expect(service.updateTemplate).toHaveBeenCalledWith('org-1', mockTemplate.id, dto);
  });

  it('should delete email template', async () => {
    const result = await controller.deleteTemplate('org-1', mockTemplate.id);
    expect(result).toEqual(mockTemplate);
    expect(service.deleteTemplate).toHaveBeenCalledWith('org-1', mockTemplate.id);
  });

  it('should send email', async () => {
    const dto = { templateId: mockTemplate.id, recipient: 'user@example.com' };
    const result = await controller.sendEmail('org-1', dto);
    expect(result).toEqual({ success: true });
    expect(service.sendTemplatedEmail).toHaveBeenCalledWith('org-1', dto);
  });
});
