import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import type { InitAmiqusDto, InitDocuSealDto } from './dto/compliance.dto';

const AMIQUS_BASE = 'https://id.amiqus.co/api/v2';
const PMA_EMAIL = 'admin@allianzhousing.co.uk';
const PMA_NAME = 'Allianz Housing';

/** Amiqus API step types (see Amiqus ID API docs). */
const AMIQUS_STEP_PHOTO_ID = 'check.photo_id';
/** Criminal record step name per Amiqus create-record examples (`check.criminal` is not the documented type). */
const AMIQUS_STEP_CRIMINAL_DEFAULT = 'check.criminal_record';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private readonly config: ConfigService) {}

  private requireAmiqusKey(): string {
    const key = this.config.get<string>('AMIQUS_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException('AMIQUS_API_KEY is not configured');
    }
    return key;
  }

  private requireDocusealConfig(): { apiKey: string; baseUrl: string } {
    const apiKey = this.config.get<string>('DOCUSEAL_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('DOCUSEAL_URL')?.trim()?.replace(/\/$/, '');
    if (!apiKey) {
      throw new ServiceUnavailableException('DOCUSEAL_API_KEY is not configured');
    }
    if (!baseUrl) {
      throw new ServiceUnavailableException('DOCUSEAL_URL is not configured');
    }
    return { apiKey, baseUrl };
  }

  private partnerBackendBaseUrl(): string | null {
    const v = this.config.get<string>('PARTNER_BACKEND_URL')?.trim();
    if (!v) return null;
    return v.replace(/\/$/, '');
  }

  /**
   * Non-blocking mirror to partner backend. Never throws.
   */
  private async postToPartner(path: string, payload: Record<string, unknown>, tag: string): Promise<void> {
    const base = this.partnerBackendBaseUrl();
    if (!base) {
      this.logger.warn(`[PartnerSync:${tag}] PARTNER_BACKEND_URL not configured; skipping`);
      return;
    }

    const url = `${base}${path}`;
    try {
      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        this.logger.log(`[PartnerSync:${tag}] ok status=${res.status} url=${url}`);
      } else {
        this.logger.warn(
          `[PartnerSync:${tag}] failed status=${res.status} url=${url} body=${JSON.stringify(res.data).slice(0, 500)}`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`[PartnerSync:${tag}] error url=${url} message=${e?.message}`);
    }
  }

  private templateIdForContract(contractType: 'HSPSLA' | 'TENANTS'): number {
    const envKey =
      contractType === 'HSPSLA' ? 'HSPSLA_TEMPLATE_ID' : 'TENANTS_TEMPLATE_ID';
    const raw = this.config.get<string>(envKey)?.trim();
    const n = parseInt(raw || '', 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException(`${envKey} must be a positive integer`);
    }
    return n;
  }

  private formatTodayDdMmYyyy(): string {
    const d = new Date();
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getUTCFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  private unwrapAxiosError(e: unknown, provider: string): never {
    if (axios.isAxiosError(e)) {
      const ax = e as AxiosError<unknown>;
      const status = ax.response?.status ?? 502;
      const details = ax.response?.data;
      this.logger.warn(
        `${provider} HTTP error status=${status} message=${ax.message} data=${typeof details === 'object' ? JSON.stringify(details).slice(0, 500) : details}`,
      );
      throw new BadGatewayException({
        message: `${provider} request failed`,
        status,
        details: details ?? ax.message,
      });
    }
    this.logger.error(`${provider} unexpected error: ${(e as Error)?.message}`, (e as Error)?.stack);
    throw new InternalServerErrorException(`${provider} request failed`);
  }

  private parseDocuSealErrorMessage(data: unknown): string {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      const maybe = (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
      try {
        return JSON.stringify(data);
      } catch {
        return '';
      }
    }
    return '';
  }

  private isDocuSealUnknownFieldError(data: unknown): boolean {
    const msg = this.parseDocuSealErrorMessage(data).toLowerCase();
    return msg.includes('unknown field');
  }

  /** Photo ID preferences: many teams require `standard` + `docs`; `biometric` is a separate product line in Amiqus. */
  private amiqusPhotoIdPreferences(reportType: string): Record<string, unknown> {
    const t = reportType.trim().toLowerCase();
    if (t === 'biometric') {
      return { report_type: 'biometric' };
    }
    return {
      report_type: 'standard',
      docs: ['passport', 'driving_licence', 'national_id'],
    };
  }

  /**
   * Create Amiqus client, then record (photo ID; optional criminal step); return perform_url.
   */
  async initAmiqus(dto: InitAmiqusDto): Promise<{ performUrl: string; recordId: number; clientId: number }> {
    const token = this.requireAmiqusKey();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const enableCriminalRaw = this.config.get<string>('AMIQUS_ENABLE_CRIMINAL_RECORD_STEP')?.trim().toLowerCase();
    const includeCriminalStep =
      enableCriminalRaw === 'true' || enableCriminalRaw === '1' || enableCriminalRaw === 'yes';

    const criminalStepTypeConfigured = this.config.get<string>('AMIQUS_DBS_STEP_TYPE')?.trim();
    const criminalStepType =
      criminalStepTypeConfigured || AMIQUS_STEP_CRIMINAL_DEFAULT;
    const photoReportType =
      this.config.get<string>('AMIQUS_PHOTO_ID_REPORT_TYPE')?.trim() || 'standard';
    const criminalRegion =
      this.config.get<string>('AMIQUS_CRIMINAL_RECORD_REGION')?.trim() || 'england';
    const criminalCheckType =
      this.config.get<string>('AMIQUS_CRIMINAL_RECORD_TYPE')?.trim() || 'standard';
    const recordClientMessage = this.config.get<string>('AMIQUS_RECORD_CLIENT_MESSAGE')?.trim();
    const reminderRaw = this.config.get<string>('AMIQUS_RECORD_REMINDER')?.trim().toLowerCase();
    const recordReminder =
      reminderRaw === undefined || reminderRaw === ''
        ? true
        : reminderRaw === 'true' || reminderRaw === '1' || reminderRaw === 'yes';

    try {
      const clientRes = await axios.post(
        `${AMIQUS_BASE}/clients`,
        {
          name: {
            title: 'mr',
            first_name: dto.firstName,
            last_name: dto.lastName,
          },
          email: dto.email,
        },
        { headers, validateStatus: () => true },
      );

      if (clientRes.status < 200 || clientRes.status >= 300) {
        this.logger.warn(`Amiqus create client failed: ${clientRes.status} ${JSON.stringify(clientRes.data)}`);
        throw new BadGatewayException({
          message: 'Amiqus create client failed',
          status: clientRes.status,
          details: clientRes.data,
        });
      }

      const clientId = (clientRes.data as { id?: number })?.id;
      if (typeof clientId !== 'number') {
        this.logger.error(`Amiqus client response missing id: ${JSON.stringify(clientRes.data)}`);
        throw new BadGatewayException('Amiqus create client returned an unexpected response');
      }

      const photoStep = {
        type: AMIQUS_STEP_PHOTO_ID,
        preferences: this.amiqusPhotoIdPreferences(photoReportType),
      };

      const steps: Array<Record<string, unknown>> = [photoStep];
      if (includeCriminalStep) {
        const criminalStep =
          criminalStepType === AMIQUS_STEP_CRIMINAL_DEFAULT
            ? {
                type: criminalStepType,
                preferences: {
                  region: criminalRegion,
                  type: criminalCheckType,
                },
              }
            : { type: criminalStepType };
        steps.push(criminalStep);
      }

      const recordBody: Record<string, unknown> = {
        client: clientId,
        steps,
        notification: false,
        reminder: recordReminder,
      };
      if (recordClientMessage) {
        recordBody.message = recordClientMessage;
      }

      const recordRes = await axios.post(`${AMIQUS_BASE}/records`, recordBody, {
        headers,
        validateStatus: () => true,
      });

      if (recordRes.status < 200 || recordRes.status >= 300) {
        this.logger.warn(`Amiqus create record failed: ${recordRes.status} ${JSON.stringify(recordRes.data)}`);
        throw new BadGatewayException({
          message: 'Amiqus create record failed',
          status: recordRes.status,
          details: recordRes.data,
        });
      }

      const data = recordRes.data as {
        id?: number;
        perform_url?: string;
      };
      const recordId = data.id;
      const performUrl = data.perform_url;

      if (typeof recordId !== 'number' || typeof performUrl !== 'string' || !performUrl) {
        this.logger.error(`Amiqus record response missing id/perform_url: ${JSON.stringify(recordRes.data)}`);
        throw new BadGatewayException('Amiqus create record returned an unexpected response');
      }

      await this.postToPartner(
        '/api/internal/compliance/link-record',
        {
          email: dto.email,
          amiqus_record_id: String(recordId),
        },
        'amiqus-link-record',
      );

      this.logger.log(`Amiqus record created recordId=${recordId} clientId=${clientId}`);
      return { performUrl, recordId, clientId };
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      this.unwrapAxiosError(e, 'Amiqus');
    }
  }

  /**
   * DocuSeal: create submission with two submitters; return HSP embed slug.
   */
  async initDocuSeal(dto: InitDocuSealDto): Promise<{ slug: string; submissionId?: number }> {
    const { apiKey, baseUrl } = this.requireDocusealConfig();
    const templateId = this.templateIdForContract(dto.contractType);
    const today = this.formatTodayDdMmYyyy();

    // IMPORTANT: DocuSeal field names must match template labels exactly.
    // HSPSLA (template 1) and TENANTS (template 2) use different field names.
    const hspFields =
      dto.contractType === 'TENANTS'
        ? [
            { name: 'HSP Financial Contact Name', default_value: dto.hspName },
            { name: 'HSP Financial Contact Address', default_value: dto.registeredAddress },
            { name: 'HSP Financial Contact Email', default_value: dto.hspEmail },
            { name: 'HSP Signatory Name', default_value: dto.hspName },
            {
              name: 'HSP Signatory Date',
              default_value: today,
              preferences: { format: 'DD/MM/YYYY' },
            },
          ]
        : [
            { name: 'Date', default_value: today, preferences: { format: 'DD/MM/YYYY' } },
            { name: 'Company Name', default_value: dto.companyName },
            { name: 'Registered Office Address', default_value: dto.registeredAddress },
            { name: 'Company Reg Number', default_value: dto.companyRegNumber },
            { name: 'HSP Property Address', default_value: dto.registeredAddress },
            { name: 'HSP Director Name', default_value: dto.hspName },
            { name: 'Date', default_value: today, preferences: { format: 'DD/MM/YYYY' } },
          ];

    const pmaFields =
      dto.contractType === 'HSPSLA'
        ? [
            { name: 'PMA Director Name', default_value: PMA_NAME },
            { name: 'PMA Job Title', default_value: 'Partnering Managing Agent' },
            { name: 'PMA Signatory Date', default_value: today, preferences: { format: 'DD/MM/YYYY' } },
          ]
        : [];

    const payload = {
      template_id: templateId,
      send_email: false,
      submitters: [
        {
          role: 'HSP',
          email: dto.hspEmail,
          name: dto.hspName,
          send_email: false,
          fields: hspFields,
        },
        {
          role: 'PMA',
          email: PMA_EMAIL,
          name: PMA_NAME,
          send_email: false,
          fields: pmaFields,
        },
      ],
    };

    const url = `${baseUrl}/api/submissions`;

    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': apiKey,
        },
        validateStatus: () => true,
      });

      if (res.status < 200 || res.status >= 300) {
        const canFallback = this.isDocuSealUnknownFieldError(res.data);

        if (canFallback) {
          this.logger.warn(
            `DocuSeal ${dto.contractType} prefill field mismatch detected (unknown field). Retrying without prefill fields.`,
          );

          const fallbackPayload = {
            ...payload,
            submitters: payload.submitters.map((s) => ({ ...s, fields: [] as Array<unknown> })),
          };

          const fallbackRes = await axios.post(url, fallbackPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': apiKey,
            },
            validateStatus: () => true,
          });

          if (fallbackRes.status >= 200 && fallbackRes.status < 300) {
            const fallbackSubmitters = fallbackRes.data as Array<{
              slug?: string;
              role?: string;
              submission_id?: number;
            }>;
            if (!Array.isArray(fallbackSubmitters)) {
              throw new BadGatewayException('DocuSeal returned an unexpected response');
            }
            const fallbackHsp = fallbackSubmitters.find((s) => s.role === 'HSP');
            const fallbackSlug = fallbackHsp?.slug;
            if (!fallbackSlug) {
              throw new BadGatewayException('DocuSeal response missing HSP submitter slug');
            }
            const fallbackSubmissionId =
              fallbackHsp?.submission_id ?? fallbackSubmitters[0]?.submission_id;
            this.logger.log(
              `DocuSeal fallback submission created templateId=${templateId} slug=${fallbackSlug} submissionId=${fallbackSubmissionId}`,
            );
            if (fallbackSubmissionId != null) {
              await this.postToPartner(
                '/api/internal/compliance/link-record',
                dto.contractType === 'HSPSLA'
                  ? {
                      email: dto.hspEmail,
                      hspsla_submission_id: String(fallbackSubmissionId),
                    }
                  : {
                      email: dto.hspEmail,
                      tenants_sla_submission_id: String(fallbackSubmissionId),
                    },
                'docuseal-link-record-fallback',
              );
            } else {
              this.logger.warn(
                '[PartnerSync:docuseal-link-record-fallback] missing submissionId, skipping partner link',
              );
            }
            return { slug: fallbackSlug, submissionId: fallbackSubmissionId };
          }

          this.logger.warn(
            `DocuSeal fallback failed: ${fallbackRes.status} ${JSON.stringify(fallbackRes.data)}`,
          );
          throw new BadGatewayException({
            message: 'DocuSeal create submission failed',
            status: fallbackRes.status,
            details: fallbackRes.data,
          });
        }

        this.logger.warn(
          `DocuSeal create submission failed: ${res.status} ${JSON.stringify(res.data)}`,
        );
        throw new BadGatewayException({
          message: 'DocuSeal create submission failed',
          status: res.status,
          details: res.data,
        });
      }

      const submitters = res.data as Array<{
        slug?: string;
        role?: string;
        submission_id?: number;
      }>;

      if (!Array.isArray(submitters)) {
        this.logger.error(`DocuSeal unexpected response shape: ${JSON.stringify(res.data).slice(0, 800)}`);
        throw new BadGatewayException('DocuSeal returned an unexpected response');
      }

      const hsp = submitters.find((s) => s.role === 'HSP');
      const slug = hsp?.slug;
      if (!slug) {
        this.logger.error(`DocuSeal no HSP submitter slug in: ${JSON.stringify(submitters)}`);
        throw new BadGatewayException('DocuSeal response missing HSP submitter slug');
      }

      const submissionId = hsp?.submission_id ?? submitters[0]?.submission_id;
      if (submissionId != null) {
        await this.postToPartner(
          '/api/internal/compliance/link-record',
          dto.contractType === 'HSPSLA'
            ? {
                email: dto.hspEmail,
                hspsla_submission_id: String(submissionId),
              }
            : {
                email: dto.hspEmail,
                tenants_sla_submission_id: String(submissionId),
              },
          'docuseal-link-record',
        );
      } else {
        this.logger.warn('[PartnerSync:docuseal-link-record] missing submissionId, skipping partner link');
      }
      this.logger.log(`DocuSeal submission created templateId=${templateId} slug=${slug} submissionId=${submissionId}`);
      return { slug, submissionId };
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      this.unwrapAxiosError(e, 'DocuSeal');
    }
  }

  /**
   * Amiqus webhook: extract record ID from data.record.id, use trigger alias to determine
   * completion, then call Amiqus API to confirm status and update partner backend.
   *
   * Official payload structure (from Amiqus docs):
   * {
   *   trigger: { alias: "record.finished" | "record.status" | ... },
   *   data: { record: { id: 123, show: "https://..." } }
   * }
   */
  async handleAmiqusWebhook(body: Record<string, unknown>): Promise<{ received: boolean; recordId?: number; status?: string }> {
    const recordId = this.extractAmiqusRecordId(body);
    const triggerAlias = this.extractAmiqusTriggerAlias(body);

    this.logger.log(`Amiqus webhook recordId=${recordId ?? 'unknown'} trigger=${triggerAlias ?? 'unknown'}`);

    // record.finished = user completed all steps; record.status = status changed
    const isCompletionEvent =
      triggerAlias === 'record.finished' ||
      triggerAlias === 'record.status' ||
      triggerAlias === 'record.completed';

    if (isCompletionEvent && recordId != null) {
      // Fetch the actual record status from Amiqus to confirm it is completed
      let resolvedStatus: string | undefined;
      try {
        const token = this.requireAmiqusKey();
        const recordRes = await axios.get(`${AMIQUS_BASE}/records/${recordId}`, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true,
        });
        if (recordRes.status === 200) {
          resolvedStatus = (recordRes.data as { status?: string })?.status;
          this.logger.log(`Amiqus record ${recordId} fetched status=${resolvedStatus}`);
        } else {
          this.logger.warn(`Amiqus fetch record ${recordId} failed: ${recordRes.status}`);
        }
      } catch (e: any) {
        this.logger.warn(`Amiqus fetch record ${recordId} error: ${e?.message}`);
      }

      const finalStatus = resolvedStatus ?? 'completed';
      await this.postToPartner(
        '/api/internal/compliance/update-status',
        {
          amiqus_record_id: String(recordId),
          status: finalStatus,
        },
        'amiqus-webhook-update-status',
      );
      return { received: true, recordId, status: finalStatus };
    }

    // Non-completion events (record.created, step.completed, ping, etc.) — acknowledge only
    this.logger.log(`Amiqus webhook trigger=${triggerAlias} recordId=${recordId ?? 'none'} — no action taken`);
    return { received: true, recordId, status: triggerAlias };
  }

  /**
   * DocuSeal webhook: log submission + template; placeholder contract_signed flags.
   */
  async handleDocuSealWebhook(body: Record<string, unknown>): Promise<{
    received: boolean;
    submissionId?: number;
    templateId?: number;
  }> {
    const submissionId = this.extractDocuSealSubmissionId(body);
    const templateId = this.extractDocuSealTemplateId(body);

    this.logger.log(`DocuSeal webhook submissionId=${submissionId ?? 'unknown'} templateId=${templateId ?? 'unknown'}`);

    const looksComplete = this.isDocuSealCompletionPayload(body);
    if (!looksComplete) {
      this.logger.log('DocuSeal webhook ignored for contract placeholder (not a completion event)');
      return { received: true, submissionId, templateId };
    }

    if (submissionId != null && templateId != null) {
      await this.postToPartner(
        '/api/internal/compliance/update-status',
        {
          submission_id: submissionId,
          template_id: templateId,
        },
        'docuseal-webhook-update-status',
      );
    }

    return { received: true, submissionId, templateId };
  }

  /** Heuristic: DocuSeal webhook shapes vary; treat obvious completion signals as signed. */
  private isDocuSealCompletionPayload(body: Record<string, unknown>): boolean {
    const ev = String(body.event_type ?? body.event ?? body.type ?? '').toLowerCase();
    if (ev.includes('complete') || ev.includes('completed') || ev.includes('submission.completed')) {
      return true;
    }
    const sub = body.submission as Record<string, unknown> | undefined;
    if (sub && String(sub.status ?? '').toLowerCase() === 'completed') {
      return true;
    }
    if (String(body.status ?? '').toLowerCase() === 'completed') {
      return true;
    }
    const data = body.data as Record<string, unknown> | undefined;
    if (data) {
      const inner = data.submission as Record<string, unknown> | undefined;
      if (inner && String(inner.status ?? '').toLowerCase() === 'completed') return true;
      const iev = String(data.event_type ?? data.event ?? '').toLowerCase();
      if (iev.includes('complete')) return true;
    }
    return false;
  }

  private parseEnvTemplateId(key: 'HSPSLA_TEMPLATE_ID' | 'TENANTS_TEMPLATE_ID'): number | undefined {
    const raw = this.config.get<string>(key)?.trim();
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private extractAmiqusRecordId(body: Record<string, unknown>): number | undefined {
    // Official Amiqus payload: { data: { record: { id: 123 } } }
    const data = body.data as Record<string, unknown> | undefined;
    if (data) {
      const inner = data.record as Record<string, unknown> | undefined;
      if (inner && typeof inner.id === 'number') return inner.id;
      if (inner && typeof inner.id === 'string' && /^\d+$/.test(inner.id)) return parseInt(inner.id, 10);
      if (typeof data.record_id === 'number') return data.record_id;
      if (typeof data.id === 'number') return data.id;
    }
    // Fallback: top-level id or record.id
    const direct = body.id;
    if (typeof direct === 'number') return direct;
    if (typeof direct === 'string' && /^\d+$/.test(direct)) return parseInt(direct, 10);
    const record = body.record as Record<string, unknown> | undefined;
    if (record && typeof record.id === 'number') return record.id;
    return undefined;
  }

  private extractAmiqusTriggerAlias(body: Record<string, unknown>): string | undefined {
    // Official Amiqus payload: { trigger: { alias: "record.finished" } }
    const trigger = body.trigger as Record<string, unknown> | undefined;
    if (trigger && typeof trigger.alias === 'string') return trigger.alias;
    // Fallback
    if (typeof body.event === 'string') return body.event;
    if (typeof body.type === 'string') return body.type;
    return undefined;
  }

  private extractDocuSealSubmissionId(body: Record<string, unknown>): number | undefined {
    const sub = body.submission as Record<string, unknown> | undefined;
    if (sub && typeof sub.id === 'number') return sub.id;
    if (typeof body.submission_id === 'number') return body.submission_id;
    const data = body.data as Record<string, unknown> | undefined;
    if (data) {
      const inner = data.submission as Record<string, unknown> | undefined;
      if (inner && typeof inner.id === 'number') return inner.id;
      if (typeof data.submission_id === 'number') return data.submission_id;
    }
    return undefined;
  }

  private extractDocuSealTemplateId(body: Record<string, unknown>): number | undefined {
    const sub = body.submission as Record<string, unknown> | undefined;
    if (sub && typeof sub.template_id === 'number') return sub.template_id;
    if (typeof body.template_id === 'number') return body.template_id;
    const data = body.data as Record<string, unknown> | undefined;
    if (data) {
      const inner = data.submission as Record<string, unknown> | undefined;
      if (inner && typeof inner.template_id === 'number') return inner.template_id;
      if (typeof data.template_id === 'number') return data.template_id;
    }
    return undefined;
  }

}
