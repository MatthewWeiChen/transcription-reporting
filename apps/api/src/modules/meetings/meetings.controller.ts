import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from "@nestjs/swagger";
import { MeetingsService } from "./meetings.service";
import { CreateMeetingRecordDto, GetMeetingsQueryDto } from "./dto";
import { ApiResponseDto } from "@/common/dto/api-response.dto";
import { MeetingRecord, PaginatedResponse } from "@packages/shared/types";

@ApiTags("meetings")
@Controller("meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new meeting record" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Meeting record created successfully",
    type: ApiResponseDto<MeetingRecord>,
  })
  @UseInterceptors(FileInterceptor("audioFile"))
  @UsePipes(new ValidationPipe({ transform: true }))
  async createMeetingRecord(
    @Body() createMeetingDto: CreateMeetingRecordDto,
    @UploadedFile() audioFile?: Express.Multer.File
  ): Promise<ApiResponseDto<MeetingRecord>> {
    try {
      const meetingRecord = await this.meetingsService.createMeetingRecord(
        createMeetingDto,
        audioFile
      );

      return {
        success: true,
        data: meetingRecord,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({
    summary: "Get meeting records with pagination and filtering",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Meeting records retrieved successfully",
  })
  async getMeetings(
    @Query() query: GetMeetingsQueryDto
  ): Promise<PaginatedResponse<MeetingRecord>> {
    const result = await this.meetingsService.getMeetings(query);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    };
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get meeting statistics" })
  async getStatistics(@Query("groupNumber") groupNumber?: string) {
    const stats = await this.meetingsService.getStatistics(groupNumber);

    return {
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    };
  }

  @Post("sync-to-sheets")
  @ApiOperation({ summary: "Manually sync records to Google Sheets" })
  async syncToSheets() {
    const result = await this.meetingsService.syncToGoogleSheets();

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    };
  }
}

// apps/api/src/modules/meetings/meetings.service.ts
import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/modules/database/prisma.service";
import { TranscriptionService } from "@/modules/transcription/transcription.service";
import { GoogleSheetsService } from "@/modules/integrations/google-sheets.service";
import { ValidationService } from "@/common/services/validation.service";
import { DateUtilsService } from "@/common/services/date-utils.service";
import { CreateMeetingRecordDto, GetMeetingsQueryDto } from "./dto";
import {
  MeetingRecord,
  RecordingStatus,
  ProcessingStatus,
  PaginatedResponse,
  DailyStatistics,
  GroupStatistics,
} from "@packages/shared/types";

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptionService: TranscriptionService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly validationService: ValidationService,
    private readonly dateUtils: DateUtilsService,
    private readonly configService: ConfigService
  ) {}

  async createMeetingRecord(
    dto: CreateMeetingRecordDto,
    audioFile?: Express.Multer.File
  ): Promise<MeetingRecord> {
    // 1. Validate the transcription format
    const validationResult = this.validationService.validateTranscription(
      dto.fullTranscription
    );

    if (!validationResult.isValid) {
      throw new BadRequestException({
        code: "INVALID_MESSAGE_FORMAT",
        message: validationResult.message,
        details: validationResult.errors,
      });
    }

    // 2. Extract date information (MOST IMPORTANT)
    const dateData = this.dateUtils.getCurrentDateData();

    try {
      // 3. Create the meeting record
      const meetingRecord = await this.prisma.meetingRecord.create({
        data: {
          // DATE IS THE MOST IMPORTANT FIELD
          recordingDate: new Date(dateData.recordingDate),
          recordingDateTime: new Date(dateData.recordingDateTime),
          year: dateData.year,
          month: dateData.month,
          day: dateData.day,
          dayOfWeek: dateData.dayOfWeek,

          // Extracted information from voice message
          speakerName: validationResult.extractedData!.speakerName,
          groupNumber: validationResult.extractedData!.groupNumber,
          personMet: validationResult.extractedData!.personMet,
          location: validationResult.extractedData!.location,

          // Audio and transcription data
          fullTranscription: dto.fullTranscription,
          recordingDuration: dto.recordingDuration,
          audioFileUrl: audioFile ? await this.saveAudioFile(audioFile) : null,

          // Initial status
          status: RecordingStatus.SUBMITTED,
          processingStatus: ProcessingStatus.PENDING,
          validationScore: validationResult.confidence || 1.0,

          // Metadata
          ipAddress: dto.metadata?.ipAddress,
          userAgent: dto.metadata?.userAgent,
        },
      });

      // 4. Background tasks (don't await to keep response fast)
      this.processBackgroundTasks(meetingRecord.id);

      // 5. Update daily statistics
      await this.updateDailyStatistics(dateData.recordingDate);

      this.logger.log(
        `Meeting record created: ${meetingRecord.id} for date: ${dateData.recordingDate}`
      );

      return this.formatMeetingRecord(meetingRecord);
    } catch (error) {
      this.logger.error("Failed to create meeting record", error);
      throw new BadRequestException("Failed to create meeting record");
    }
  }

  async getMeetings(
    query: GetMeetingsQueryDto
  ): Promise<PaginatedResponse<MeetingRecord>> {
    const {
      page = 1,
      limit = 10,
      groupNumber,
      speakerName,
      startDate,
      endDate,
      status,
      sortBy = "recordingDate",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (groupNumber) where.groupNumber = groupNumber;
    if (speakerName)
      where.speakerName = { contains: speakerName, mode: "insensitive" };
    if (status) where.status = status;

    // Date filtering (MOST IMPORTANT for queries)
    if (startDate || endDate) {
      where.recordingDate = {};
      if (startDate) where.recordingDate.gte = new Date(startDate);
      if (endDate) where.recordingDate.lte = new Date(endDate);
    }

    // Execute queries
    const [data, total] = await Promise.all([
      this.prisma.meetingRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          group: true,
        },
      }),
      this.prisma.meetingRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: data.map(this.formatMeetingRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getStatistics(groupNumber?: string): Promise<{
    daily: DailyStatistics[];
    groups: GroupStatistics[];
    totals: {
      totalMeetings: number;
      totalGroups: number;
      totalSpeakers: number;
      avgMeetingsPerDay: number;
    };
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get daily statistics
    const dailyStats = await this.prisma.dailyStats.findMany({
      where: {
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { date: "asc" },
    });

    // Get group statistics
    const groupStats = await this.prisma.meetingRecord.groupBy({
      by: ["groupNumber"],
      where: groupNumber ? { groupNumber } : {},
      _count: {
        id: true,
      },
      _max: {
        recordingDate: true,
      },
    });

    // Get totals
    const totals = await this.prisma.meetingRecord.aggregate({
      where: groupNumber ? { groupNumber } : {},
      _count: {
        id: true,
      },
    });

    const uniqueGroups = await this.prisma.meetingRecord.findMany({
      select: { groupNumber: true },
      distinct: ["groupNumber"],
      where: groupNumber ? { groupNumber } : {},
    });

    const uniqueSpeakers = await this.prisma.meetingRecord.findMany({
      select: { speakerName: true },
      distinct: ["speakerName"],
      where: groupNumber ? { groupNumber } : {},
    });

    return {
      daily: dailyStats.map((stat) => ({
        date: stat.date.toISOString().split("T")[0],
        totalRecordings: stat.totalRecordings,
        successfulRecordings: stat.successfulRecordings,
        failedRecordings: stat.failedRecordings,
        uniqueGroups: stat.uniqueGroups,
        uniqueSpeakers: stat.uniqueSpeakers,
        averageDuration: stat.averageDuration,
      })),
      groups: groupStats.map((group) => ({
        groupNumber: group.groupNumber,
        totalMeetings: group._count.id,
        lastMeeting: group._max.recordingDate?.toISOString().split("T")[0],
        averageMeetingsPerWeek: 0, // Calculate separately if needed
        locations: [], // Calculate separately if needed
      })),
      totals: {
        totalMeetings: totals._count.id,
        totalGroups: uniqueGroups.length,
        totalSpeakers: uniqueSpeakers.length,
        avgMeetingsPerDay: totals._count.id / 30,
      },
    };
  }

  async syncToGoogleSheets(): Promise<{ synced: number; errors: number }> {
    // Get unsynced records
    const unsyncedRecords = await this.prisma.meetingRecord.findMany({
      where: {
        syncedToSheets: false,
      },
      orderBy: {
        recordingDate: "asc", // Sync by date order (most important)
      },
      take: 100, // Batch size
    });

    let synced = 0;
    let errors = 0;

    for (const record of unsyncedRecords) {
      try {
        const rowId = await this.googleSheetsService.addRecord(record);

        await this.prisma.meetingRecord.update({
          where: { id: record.id },
          data: {
            syncedToSheets: true,
            googleSheetsRowId: rowId,
            sheetsLastSync: new Date(),
          },
        });

        synced++;
      } catch (error) {
        this.logger.error(
          `Failed to sync record ${record.id} to Google Sheets`,
          error
        );
        errors++;
      }
    }

    this.logger.log(
      `Google Sheets sync completed: ${synced} synced, ${errors} errors`
    );
    return { synced, errors };
  }

  private async processBackgroundTasks(meetingRecordId: string): Promise<void> {
    // Don't await these - run in background
    setImmediate(async () => {
      try {
        // Sync to Google Sheets
        const record = await this.prisma.meetingRecord.findUnique({
          where: { id: meetingRecordId },
        });

        if (record) {
          await this.googleSheetsService.addRecord(record);

          await this.prisma.meetingRecord.update({
            where: { id: meetingRecordId },
            data: {
              syncedToSheets: true,
              sheetsLastSync: new Date(),
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Background processing failed for record ${meetingRecordId}`,
          error
        );
      }
    });
  }

  private async saveAudioFile(audioFile: Express.Multer.File): Promise<string> {
    // Save to local storage or cloud storage (S3, etc.)
    // Return the URL/path to the saved file
    const filename = `audio_${Date.now()}_${audioFile.originalname}`;
    // Implementation depends on your storage solution
    return `/uploads/audio/${filename}`;
  }

  private async updateDailyStatistics(date: string): Promise<void> {
    const dateObj = new Date(date);

    await this.prisma.dailyStats.upsert({
      where: { date: dateObj },
      update: {
        totalRecordings: { increment: 1 },
        successfulRecordings: { increment: 1 },
      },
      create: {
        date: dateObj,
        totalRecordings: 1,
        successfulRecordings: 1,
        failedRecordings: 0,
        uniqueGroups: 1,
        uniqueSpeakers: 1,
        averageDuration: 0,
      },
    });
  }

  private formatMeetingRecord(record: any): MeetingRecord {
    return {
      id: record.id,
      recordingDate: record.recordingDate.toISOString().split("T")[0],
      recordingDateTime: record.recordingDateTime.toISOString(),
      recordingDateDisplay: this.dateUtils.formatDisplayDate(
        record.recordingDate
      ),
      recordingTime: this.dateUtils.formatDisplayTime(record.recordingDateTime),
      speakerName: record.speakerName,
      groupNumber: record.groupNumber,
      personMet: record.personMet,
      location: record.location,
      fullTranscription: record.fullTranscription,
      recordingDuration: record.recordingDuration,
      year: record.year,
      month: record.month,
      day: record.day,
      dayOfWeek: record.dayOfWeek,
      status: record.status,
      processingStatus: record.processingStatus,
      validationScore: record.validationScore,
      audioFileUrl: record.audioFileUrl,
      googleSheetsRowId: record.googleSheetsRowId,
      syncedToSheets: record.syncedToSheets,
      sheetsLastSync: record.sheetsLastSync?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
