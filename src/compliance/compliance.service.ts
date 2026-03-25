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

/** Amiqus API step types (see Amiqus ID API). Identity verification + UK basic disclosure / criminal check. */
const AMIQUS_STEP_PHOTO_ID = 'check.photo_id';
/** Default DBS-basic style step; override via AMIQUS_DBS_STEP_TYPE if your team uses a different preset. */
const AMIQUS_STEP_DBS_DEFAULT = 'check.criminal';

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

  /**
   * Create Amiqus client, then record with photo ID + DBS-style step; return perform_url.
   */
  async initAmiqus(dto: InitAmiqusDto): Promise<{ performUrl: string; recordId: number; clientId: number }> {
    const token = this.requireAmiqusKey();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const dbsStepType =
      this.config.get<string>('AMIQUS_DBS_STEP_TYPE')?.trim() || AMIQUS_STEP_DBS_DEFAULT;

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

      const recordBody = {
        client: clientId,
        steps: [
          {
            type: AMIQUS_STEP_PHOTO_ID,
            preferences: {
              report_type: 'standard',
              docs: ['passport', 'driving_licence', 'national_id'],
            },
          },
          {
            type: dbsStepType,
            preferences: {},
          },
        ],
        notification: 'email',
      };

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

    const payload = {
      template_id: templateId,
      send_email: false,
      submitters: [
        {
          role: 'HSP',
          email: dto.hspEmail,
          name: dto.hspName,
          send_email: false,
          fields: [
            { name: 'Company Name', default_value: dto.companyName },
            { name: 'Company Reg Number', default_value: dto.companyRegNumber },
            { name: 'Registered Office Address', default_value: dto.registeredAddress },
            {
              name: 'Date',
              default_value: today,
              preferences: { format: 'DD/MM/YYYY' },
            },
          ],
        },
        {
          role: 'PMA',
          email: PMA_EMAIL,
          name: PMA_NAME,
          send_email: false,
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
        this.logger.warn(`DocuSeal create submission failed: ${res.status} ${JSON.stringify(res.data)}`);
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
      this.logger.log(`DocuSeal submission created templateId=${templateId} slug=${slug} submissionId=${submissionId}`);
      return { slug, submissionId };
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      this.unwrapAxiosError(e, 'DocuSeal');
    }
  }

  /**
   * Amiqus webhook: when status is completed, log and placeholder DB update for partner KYC/DBS.
   */
  async handleAmiqusWebhook(body: Record<string, unknown>): Promise<{ received: boolean; recordId?: number; status?: string }> {
    const recordId = this.extractAmiqusRecordId(body);
    const status = this.extractAmiqusStatus(body);

    this.logger.log(`Amiqus webhook recordId=${recordId ?? 'unknown'} status=${status ?? 'unknown'}`);

    if (status?.toLowerCase() === 'completed' && recordId != null) {
      this.logger.log(`Amiqus record ${recordId} completed — applying partner KYC/DBS placeholder update`);
      this.placeholderUpdatePartnerKycDbsCompleted(recordId);
    }

    return { received: true, recordId, status };
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
      const hspsla = this.parseEnvTemplateId('HSPSLA_TEMPLATE_ID');
      const tenants = this.parseEnvTemplateId('TENANTS_TEMPLATE_ID');
      if (templateId === hspsla) {
        this.placeholderUpdatePartnerContractSigned(submissionId, templateId, 'hspsla_signed');
      } else if (templateId === tenants) {
        this.placeholderUpdatePartnerContractSigned(submissionId, templateId, 'tenants_sla_signed');
      } else {
        this.logger.warn(
          `DocuSeal template ${templateId} does not match HSPSLA_TEMPLATE_ID or TENANTS_TEMPLATE_ID — no contract flag placeholder`,
        );
      }
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
    const direct = body.id;
    if (typeof direct === 'number') return direct;
    if (typeof direct === 'string' && /^\d+$/.test(direct)) return parseInt(direct, 10);

    const record = body.record as Record<string, unknown> | undefined;
    if (record && typeof record.id === 'number') return record.id;
    if (record && typeof record.id === 'string' && /^\d+$/.test(record.id)) return parseInt(record.id, 10);

    const data = body.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.record_id === 'number') return data.record_id;
      if (typeof data.id === 'number') return data.id;
      const inner = data.record as Record<string, unknown> | undefined;
      if (inner && typeof inner.id === 'number') return inner.id;
    }
    return undefined;
  }

  private extractAmiqusStatus(body: Record<string, unknown>): string | undefined {
    if (typeof body.status === 'string') return body.status;
    const record = body.record as Record<string, unknown> | undefined;
    if (record && typeof record.status === 'string') return record.status;
    const data = body.data as Record<string, unknown> | undefined;
    if (data && typeof data.status === 'string') return data.status;
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

  /** Replace with Munawar DB / repository when available */
  private placeholderUpdatePartnerKycDbsCompleted(recordId: number): void {
    this.logger.log(
      `[PLACEHOLDER] Would update partner record: kyc_status='completed', dbs_status='completed' (amiqus_record_id=${recordId})`,
    );
  }

  /** Replace with Munawar DB / repository when available */
  private placeholderUpdatePartnerContractSigned(
    submissionId: number,
    templateId: number,
    flag: 'hspsla_signed' | 'tenants_sla_signed',
  ): void {
    this.logger.log(
      `[PLACEHOLDER] Would update partner record: contract flag '${flag}' (docuseal_submission_id=${submissionId}, template_id=${templateId})`,
    );
  }
}
