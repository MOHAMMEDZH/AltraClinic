export interface VirusScanInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  tenantId: string;
}

export interface VirusScanResult {
  status: 'clean' | 'infected' | 'error';
  scannerName: string;
  details?: string;
}

/**
 * Virus scanning hook — swap implementations without changing the pipeline.
 * Production: wire ClamAV daemon, AWS GuardDuty Malware Protection, or VirusTotal API.
 */
export interface VirusScannerPort {
  scan(input: VirusScanInput): Promise<VirusScanResult>;
}

export const VIRUS_SCANNER = 'VIRUS_SCANNER';
