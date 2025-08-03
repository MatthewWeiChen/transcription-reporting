// ===== CORE TYPES =====

export interface VoiceMessage {
  speakerName: string;
  groupNumber: string;
  personMet: string;
  location: string;
}

export interface MeetingRecord {
  id: string;

  // DATE IS THE MOST IMPORTANT FIELD
  recordingDate: string; // YYYY-MM-DD
  recordingDateTime: string; // ISO 8601 timestamp
  recordingDateDisplay: string; // Human readable: "Friday, July 27, 2025"
  recordingTime: string; // HH:MM:SS AM/PM

  // Voice message data
  speakerName: string;
  groupNumber: string;
  personMet: string;
  location: string;
  fullTranscription: string;
  recordingDuration: string; // MM:SS format

  // Date components for queries
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;

  // Metadata
  status: RecordingStatus;
  processingStatus: ProcessingStatus;
  validationScore?: number;
  audioFileUrl?: string;

  // External integration
  googleSheetsRowId?: string;
  syncedToSheets: boolean;
  sheetsLastSync?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  extractedData: VoiceMessage | null;
  errors?: string[];
}

export interface AudioRecordingData {
  blob: Blob;
  url: string;
  duration: string;
  size: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  provider: TranscriptionProvider;
  processingTime: number;
  tokensUsed?: number;
  cost?: number;
}

// ===== ENUMS =====

export enum RecordingStatus {
  SUBMITTED = "SUBMITTED",
  VALIDATED = "VALIDATED",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
  ARCHIVED = "ARCHIVED",
}

export enum ProcessingStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
}

export enum TranscriptionProvider {
  OPENAI = "openai",
  GOOGLE = "google",
  AZURE = "azure",
  AWS = "aws",
}

export enum IntegrationService {
  GOOGLE_SHEETS = "google_sheets",
  DATABASE = "database",
  TRANSCRIPTION = "transcription",
  EMAIL = "email",
}

// ===== API TYPES =====

export interface CreateMeetingRecordDto {
  fullTranscription: string;
  recordingDuration: string;
  audioFile?: File;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===== GOOGLE SHEETS TYPES =====

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  headerRow: number;
  columns: {
    date: string; // Column A
    time: string; // Column B
    speakerName: string; // Column C
    groupNumber: string; // Column D
    personMet: string; // Column E
    location: string; // Column F
    dayOfWeek: string; // Column G
    transcription: string; // Column H
    duration: string; // Column I
  };
}

export interface GoogleSheetsRow {
  date: string;
  time: string;
  speakerName: string;
  groupNumber: string;
  personMet: string;
  location: string;
  dayOfWeek: string;
  transcription: string;
  duration: string;
}

// ===== ANALYTICS TYPES =====

export interface DailyStatistics {
  date: string;
  totalRecordings: number;
  successfulRecordings: number;
  failedRecordings: number;
  uniqueGroups: number;
  uniqueSpeakers: number;
  averageDuration: number;
}

export interface GroupStatistics {
  groupNumber: string;
  groupName?: string;
  totalMeetings: number;
  lastMeeting?: string;
  mostActiveSpeaker?: string;
  averageMeetingsPerWeek: number;
  locations: Array<{
    location: string;
    count: number;
  }>;
}

// ===== CONFIGURATION TYPES =====

export interface AppConfig {
  validation: {
    requiredPattern: RegExp;
    templateMessage: string;
    maxTranscriptionLength: number;
    allowedAudioFormats: string[];
    maxAudioSizeBytes: number;
  };
  transcription: {
    provider: TranscriptionProvider;
    apiKey: string;
    model?: string;
    language: string;
    timeout: number;
  };
  googleSheets: GoogleSheetsConfig;
  database: {
    batchSize: number;
    retryAttempts: number;
    connectionTimeout: number;
  };
}

// ===== ERROR TYPES =====

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  details?: any;
}

export enum ErrorCodes {
  // Validation Errors
  INVALID_MESSAGE_FORMAT = "INVALID_MESSAGE_FORMAT",
  MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS",
  INVALID_AUDIO_FORMAT = "INVALID_AUDIO_FORMAT",
  AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE",

  // Transcription Errors
  TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
  TRANSCRIPTION_TIMEOUT = "TRANSCRIPTION_TIMEOUT",
  TRANSCRIPTION_QUOTA_EXCEEDED = "TRANSCRIPTION_QUOTA_EXCEEDED",

  // Database Errors
  DATABASE_CONNECTION_FAILED = "DATABASE_CONNECTION_FAILED",
  RECORD_NOT_FOUND = "RECORD_NOT_FOUND",
  DUPLICATE_RECORD = "DUPLICATE_RECORD",

  // Integration Errors
  GOOGLE_SHEETS_ERROR = "GOOGLE_SHEETS_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",

  // System Errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

// ===== FORM TYPES =====

export interface RecordingFormState {
  isRecording: boolean;
  recordingDuration: string;
  transcription: string;
  validationResult: ValidationResult;
  extractedData: VoiceMessage | null;
  audioData: AudioRecordingData | null;
  isSubmitting: boolean;
  submitSuccess: boolean;
  error: string | null;
}

// ===== UTILITY TYPES =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
