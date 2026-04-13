import { z } from 'zod';

export const systemSettingsSchema = z.object({
  cattery_name:               z.string().min(1).max(200),
  cattery_logo_url:           z.string().url().nullable().optional().or(z.literal('')),
  cattery_timezone:           z.string().min(1).max(100),
  default_currency:           z.string().min(1).max(10),
  gestation_days:             z.number().int().min(30).max(120),
  vaccination_lead_days:      z.number().int().min(0).max(60),
  preventive_lead_days:       z.number().int().min(0).max(60),
  vet_followup_lead_days:     z.number().int().min(0).max(60),
  weight_drop_alert_pct:      z.number().int().min(1).max(50),
  push_notifications_enabled: z.boolean()
});
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
