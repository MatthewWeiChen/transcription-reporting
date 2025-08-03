// apps/web/src/lib/validation.ts
import { ValidationResult, VoiceMessage } from "@packages/shared/types";

// Required message pattern - exactly as specified
const REQUIRED_PATTERN =
  /^my name is (.+?) and i belong to group (.+?) and today i met (.+?) at (.+?)\.?$/i;

export function validateTranscription(text: string): ValidationResult {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      isValid: false,
      message: "",
      extractedData: null,
    };
  }

  const match = trimmedText.match(REQUIRED_PATTERN);

  if (match) {
    const extractedData: VoiceMessage = {
      speakerName: match[1].trim(),
      groupNumber: match[2].trim(),
      personMet: match[3].trim(),
      location: match[4].trim(),
    };

    // Additional validation
    const errors = validateExtractedData(extractedData);

    if (errors.length > 0) {
      return {
        isValid: false,
        message: "Format is correct but data has issues: " + errors.join(", "),
        extractedData,
        errors,
      };
    }

    return {
      isValid: true,
      message: "✅ Perfect! The message follows the required format.",
      extractedData,
    };
  } else {
    return {
      isValid: false,
      message:
        '❌ Please follow the exact format: "My name is [name] and I belong to group [#] and today I met [name] at [location]."',
      extractedData: null,
    };
  }
}

function validateExtractedData(data: VoiceMessage): string[] {
  const errors: string[] = [];

  // Validate speaker name
  if (!isValidName(data.speakerName)) {
    errors.push("Invalid speaker name");
  }

  // Validate group number
  if (!isValidGroupNumber(data.groupNumber)) {
    errors.push("Group number must be a valid number");
  }

  // Validate person met
  if (!isValidName(data.personMet)) {
    errors.push("Invalid person name");
  }

  // Validate location
  if (!isValidLocation(data.location)) {
    errors.push("Invalid location");
  }

  return errors;
}

function isValidName(name: string): boolean {
  return (
    name.length >= 2 && name.length <= 100 && /^[a-zA-Z\s\-\.\']+$/.test(name)
  );
}

function isValidGroupNumber(groupStr: string): boolean {
  const groupNum = parseInt(groupStr, 10);
  return !isNaN(groupNum) && groupNum > 0 && groupNum <= 999;
}

function isValidLocation(location: string): boolean {
  return (
    location.length >= 2 &&
    location.length <= 200 &&
    /^[a-zA-Z0-9\s\-\.\,\']+$/.test(location)
  );
}

// apps/web/src/lib/dateUtils.ts
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDatabaseDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getCurrentDateData() {
  const now = new Date();

  return {
    recordingDate: formatDatabaseDate(now),
    recordingDateTime: now.toISOString(),
    recordingDateDisplay: formatDateDisplay(now),
    recordingTime: formatTimeDisplay(now),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    timestamp: now.getTime(),
  };
}

// apps/web/src/lib/api.ts
import {
  CreateMeetingRecordDto,
  ApiResponse,
  MeetingRecord,
} from "@packages/shared/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error?.message || "An error occurred",
      response.status,
      data.error?.code
    );
  }

  return data;
}

export async function submitMeetingRecord(
  data: CreateMeetingRecordDto
): Promise<MeetingRecord> {
  const formData = new FormData();

  // Add text fields
  formData.append("fullTranscription", data.fullTranscription);
  formData.append("recordingDuration", data.recordingDuration);

  // Add metadata if provided
  if (data.metadata) {
    formData.append("metadata", JSON.stringify(data.metadata));
  }

  // Add audio file if provided
  if (data.audioFile) {
    formData.append("audioFile", data.audioFile);
  }

  const response = await fetch(`${API_BASE_URL}/meetings`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new ApiError(
      result.error?.message || "Failed to submit meeting record",
      response.status,
      result.error?.code
    );
  }

  return result.data;
}

export async function getMeetings(params?: {
  page?: number;
  limit?: number;
  groupNumber?: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  return fetchApi<MeetingRecord[]>(`/meetings?${searchParams.toString()}`);
}

export async function getMeetingStatistics(groupNumber?: string) {
  const params = groupNumber ? `?groupNumber=${groupNumber}` : "";
  return fetchApi(`/meetings/statistics${params}`);
}

export async function syncToGoogleSheets() {
  return fetchApi("/meetings/sync-to-sheets", {
    method: "POST",
  });
}

// apps/web/src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// apps/web/src/lib/constants.ts
export const APP_CONFIG = {
  VALIDATION: {
    MAX_TRANSCRIPTION_LENGTH: 1000,
    MIN_RECORDING_DURATION: 1, // seconds
    MAX_RECORDING_DURATION: 300, // 5 minutes
    MAX_AUDIO_SIZE_MB: 10,
    ALLOWED_AUDIO_FORMATS: ["audio/webm", "audio/wav", "audio/mp3"],
  },

  UI: {
    RECORDING_BUTTON_SIZE: 120,
    ANIMATION_DURATION: 300,
    MESSAGE_TIMEOUT: 5000,
    DEBOUNCE_DELAY: 300,
  },

  API: {
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },

  STORAGE: {
    SETTINGS_KEY: "voice-recorder-settings",
    CACHE_TTL: 3600000, // 1 hour
  },
} as const;

export const ERROR_MESSAGES = {
  MICROPHONE_ACCESS: "Could not access microphone. Please check permissions.",
  RECORDING_FAILED: "Recording failed. Please try again.",
  TRANSCRIPTION_FAILED: "Transcription failed. Please try again.",
  SUBMIT_FAILED: "Failed to submit meeting record. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  VALIDATION_ERROR: "Please ensure the message follows the required format.",
  FILE_TOO_LARGE: "Audio file is too large. Maximum size is 10MB.",
  UNSUPPORTED_FORMAT: "Unsupported audio format.",
} as const;

export const SUCCESS_MESSAGES = {
  RECORDING_COMPLETE: "Recording completed successfully!",
  TRANSCRIPTION_COMPLETE: "Transcription completed successfully!",
  SUBMIT_SUCCESS: "Meeting record submitted successfully!",
  SYNC_SUCCESS: "Data synchronized to Google Sheets!",
} as const;
