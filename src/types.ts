export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeeklyDaySchedule = Record<DayOfWeek, string[]>;

export interface UserCredential {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  passwordEncrypted: string;
  roleTag: string;
  active: boolean;
  // Horarios independientes por día de la semana
  weeklySchedule?: Partial<Record<DayOfWeek, string[]>>;
  // Días pausados temporalmente sin perder la lista de horas configuradas
  pausedDays?: DayOfWeek[];
  // Horarios globales / fallback
  scheduledTimes: string[]; // Múltiples horas diarias, ej: ["08:00", "09:45", "12:45", "13:45", "14:45", "16:45"]
  activeDays?: DayOfWeek[];
  notes?: string;
  createdAt: string;
  lastRunAt?: string;
  lastStatus?: 'success' | 'failed' | 'pending' | 'skipped';
}

export type StepActionType =
  | 'navigate'
  | 'input_text'
  | 'input_password'
  | 'click_button'
  | 'wait_for_selector'
  | 'check_element_condition'
  | 'extract_text'
  | 'screenshot'
  | 'webhook_notify';

export interface WorkflowStep {
  id: string;
  name: string;
  action: StepActionType;
  targetSelector?: string;
  value?: string;
  timeoutMs: number;
  optional?: boolean;
  description: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  description: string;
  targetUrl: string;
  cronExpression: string;
  targetTime: string; // "08:00"
  activeDays: DayOfWeek[];
  assignedUserIds: string[];
  jitterMinutes: number; // Randomize run by 0-N minutes to look natural
  retryCount: number;
  retryDelaySeconds: number;
  enabled: boolean;
  steps: WorkflowStep[];
  nextRunEstimated?: string;
  lastExecutedAt?: string;
  lastExecutionStatus?: 'success' | 'failed' | 'running' | 'idle';
}

export interface ExecutionLogEntry {
  stepId: string;
  stepName: string;
  action: StepActionType;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  timestamp: string;
  durationMs: number;
  message: string;
  screenshotUrl?: string;
  payload?: Record<string, unknown>;
}

export interface ExecutionRecord {
  id: string;
  jobId: string;
  jobName: string;
  userId: string;
  userName: string;
  userEmail: string;
  triggerType: 'scheduled_cron' | 'manual_test' | 'api_dispatch' | 'retry';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  logs: ExecutionLogEntry[];
  summaryMessage: string;
  retryAttempt: number;
}

export interface SystemHealthStatus {
  orchestratorStatus: 'active' | 'degraded' | 'idle';
  activeWorkers: number;
  totalJobs: number;
  activeUsers: number;
  successRateLast24h: number;
  nextScheduledTaskInSeconds: number;
  serverUptimeSeconds: number;
  unattendedDaemonEnabled?: boolean;
  upcomingDispatches?: UpcomingUserDispatch[];
}

export interface UpcomingUserDispatch {
  userId: string;
  userName: string;
  userRole: string;
  username: string;
  day: DayOfWeek;
  dayLabel: string;
  time: string; // e.g. "08:00"
  timeFormatted: string; // e.g. "08:00 AM"
  estimatedDate: string;
  secondsRemaining: number;
  isToday: boolean;
}
