// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'M-Edu';

  @override
  String get navHome => 'Home';

  @override
  String get navStudents => 'Students';

  @override
  String get navTeachers => 'Teachers';

  @override
  String get navAttendance => 'Attendance';

  @override
  String get navSchedule => 'Schedule';

  @override
  String get navMore => 'More';

  @override
  String get actionSave => 'Save';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionSearch => 'Search';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionBack => 'Back';

  @override
  String get actionClose => 'Close';

  @override
  String get actionSend => 'Send';

  @override
  String get actionRetry => 'Retry';

  @override
  String get commonLoading => 'Loading...';

  @override
  String get commonEmpty => 'No data';

  @override
  String get commonError => 'Something went wrong';

  @override
  String get commonNoResults => 'Nothing found';

  @override
  String get commonAll => 'All';

  @override
  String get dashboardTitle => 'Dashboard';

  @override
  String get dashboardTodayAttendance => 'Today\'s attendance';

  @override
  String get dashboardActiveStudents => 'Active students';

  @override
  String get dashboardTotalCollected => 'Total collected';

  @override
  String get dashboardDebtors => 'Debtors';

  @override
  String get dashboardQuickActions => 'Quick actions';

  @override
  String get dashboardRecentActivity => 'Recent activity';

  @override
  String get studentsTitle => 'Students';

  @override
  String get studentsAdd => 'Add student';

  @override
  String get studentsActive => 'Active';

  @override
  String get studentsArchived => 'Archived';

  @override
  String get studentsFrozen => 'Frozen';

  @override
  String get studentsGraduated => 'Graduated';

  @override
  String get studentsEmpty => 'No students yet';

  @override
  String get teachersTitle => 'Teachers';

  @override
  String get teachersAdd => 'Add teacher';

  @override
  String get groupsTitle => 'Groups';

  @override
  String get groupsAdd => 'Create group';

  @override
  String get attendanceTitle => 'Attendance';

  @override
  String get attendanceMark => 'Mark';

  @override
  String get attendancePresent => 'Present';

  @override
  String get attendanceLate => 'Late';

  @override
  String get attendanceAbsent => 'Absent';

  @override
  String get attendanceExcused => 'Excused';

  @override
  String get attendanceToday => 'Today\'s attendance';

  @override
  String get attendanceHistory => 'Attendance history';

  @override
  String get financeTitle => 'Finance';

  @override
  String get financeBalance => 'Balance';

  @override
  String get financePayments => 'Payment history';

  @override
  String get financeNewPayment => 'New payment';

  @override
  String get financeExpenses => 'Expenses';

  @override
  String get financeDebts => 'Debts';

  @override
  String get financeNewExpense => 'New expense';

  @override
  String get reportsTitle => 'Reports';

  @override
  String get reportsStudentStats => 'Student statistics';

  @override
  String get reportsMonthlyAttendance => 'Monthly attendance';

  @override
  String get reportsRevenue => 'Revenue';

  @override
  String get reportsDebts => 'Debts';

  @override
  String get scheduleTitle => 'Schedule';

  @override
  String get scheduleRooms => 'Rooms';

  @override
  String get scheduleNoLessons => 'No lessons scheduled for this day';

  @override
  String get scheduleAddLesson => 'Add lesson';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsTheme => 'Theme';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsThemeSystem => 'System';

  @override
  String get settingsNotifications => 'Notifications';

  @override
  String get settingsBiometric => 'Fingerprint login';

  @override
  String get settingsVibration => 'Vibration';

  @override
  String get settingsSms => 'Send SMS';

  @override
  String get settingsTelegram => 'Telegram';

  @override
  String get gamificationTitle => 'Gamification';

  @override
  String get gamificationPoints => 'points';

  @override
  String get gamificationLevel => 'LEVEL';

  @override
  String get gamificationAchievements => 'Achievements';

  @override
  String get gamificationNextLevel => 'Next level';

  @override
  String get gamificationMaxLevel => 'Max level';

  @override
  String get identityTitle => 'ID Persons';

  @override
  String get identityAdd => 'Add person';

  @override
  String get identityScan => 'QR scanner';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsSend => 'Send';

  @override
  String get moreTitle => 'More';

  @override
  String get moreFinance => 'Finance';

  @override
  String get moreReports => 'Reports';

  @override
  String get moreManagement => 'Management';

  @override
  String get moreConnections => 'Connections';

  @override
  String get moreSystem => 'System';

  @override
  String get loginTitle => 'Sign in';

  @override
  String get loginPhone => 'Phone number';

  @override
  String get loginPassword => 'Password';

  @override
  String get loginButton => 'Sign in';

  @override
  String get registerTitle => 'Register';

  @override
  String get dialogConfirmDeleteTitle => 'Confirm deletion';

  @override
  String get dialogConfirmDeleteBody =>
      'This action cannot be undone. Continue?';

  @override
  String get dialogDeleteStudent => 'Delete this student?';

  @override
  String get dialogDeleteTeacher => 'Delete this teacher?';

  @override
  String get loginEmail => 'Email';

  @override
  String get loginEmailHint => 'info@medu.uz';

  @override
  String get loginEmailRequired => 'Enter email';

  @override
  String get loginEmailInvalid => 'Enter a valid email';

  @override
  String get loginPasswordRequired => 'Enter password';

  @override
  String get loginPasswordShort =>
      'Password must be 8+ chars with upper, lower, and digit';

  @override
  String get loginBiometric => 'Biometric login';

  @override
  String get loginFaceId => 'Face ID login';

  @override
  String get loginSubtitle => 'Education Center Management System';

  @override
  String get loginSecureNote =>
      'Accounts are stored encrypted on this device.\nYou cannot sign in with a fake email.';

  @override
  String get loginNoAccount => 'Don\'t have an account? ';

  @override
  String get loginRegister => 'Register';

  @override
  String get loginForgotPassword => 'Forgot password?';

  @override
  String get loginForgotTitle => 'Password recovery';

  @override
  String get loginForgotBody =>
      'This device\'s account password is stored encrypted and cannot be recovered. Contact an administrator or create a new account.';

  @override
  String get loginErrorTitle => 'Sign-in failed';

  @override
  String get loginLoadingLabel => 'Signing in…';

  @override
  String get loginDialogOk => 'Got it';

  @override
  String get registerName => 'Full name';

  @override
  String get registerNameRequired => 'Enter your name';

  @override
  String get registerEmail => 'Email';

  @override
  String get registerEmailInvalid => 'Enter a valid email';

  @override
  String get registerPassword => 'Password (8+ chars, A-z, 0-9)';

  @override
  String get registerConfirm => 'Repeat password';

  @override
  String get registerButton => 'Create account';

  @override
  String get registerHaveAccount => 'Already have an account? ';

  @override
  String get registerLogin => 'Sign in';

  @override
  String get registerSubtitle =>
      'The first account becomes the system owner (Super Admin)';

  @override
  String get moreAllSections => 'All sections and settings';

  @override
  String get morePayments => 'Payments';

  @override
  String get morePaymentsSubtitle => 'Payment history and balance';

  @override
  String get moreDebts => 'Debts';

  @override
  String get moreDebtsSubtitle => 'Overdue payments';

  @override
  String get moreNewPayment => 'Receive payment';

  @override
  String get moreNewPaymentSubtitle => 'Record a new payment';

  @override
  String get moreExpense => 'Expense';

  @override
  String get moreExpenseSubtitle => 'Enter a new expense';

  @override
  String get moreReportsCenter => 'Reports center';

  @override
  String get moreReportsCenterSubtitle => 'Main reports page';

  @override
  String get moreStudentStats => 'Student statistics';

  @override
  String get moreStudentStatsSubtitle => 'Per student';

  @override
  String get moreMonthlyAttendance => 'Monthly attendance';

  @override
  String get moreMonthlyAttendanceSubtitle => 'Monthly attendance report';

  @override
  String get moreRevenue => 'Revenue';

  @override
  String get moreRevenueSubtitle => 'Revenue report';

  @override
  String get moreDebtReport => 'Debt report';

  @override
  String get moreDebtReportSubtitle => 'By debts';

  @override
  String get moreTeachers => 'Teachers';

  @override
  String get moreTeachersSubtitle => 'Teachers list';

  @override
  String get moreGroups => 'Groups';

  @override
  String get moreGroupsSubtitle => 'Groups and members';

  @override
  String get moreRooms => 'Rooms';

  @override
  String get moreRoomsSubtitle => 'Study rooms';

  @override
  String get moreIdPersons => 'ID Persons';

  @override
  String get moreIdPersonsSubtitle => 'All registered persons';

  @override
  String get moreNotifications => 'Notifications';

  @override
  String get moreNotificationsSubtitle => 'Sent messages';

  @override
  String get moreGamification => 'Gamification';

  @override
  String get moreGamificationSubtitle => 'Points, levels and achievements';

  @override
  String get moreFaceId => 'Face ID';

  @override
  String get moreFaceIdSubtitle => 'Attendance via Hikvision camera';

  @override
  String get moreQrScanner => 'QR scanner';

  @override
  String get moreQrScannerSubtitle => 'Check via QR code';

  @override
  String get moreTelegram => 'Telegram';

  @override
  String get moreTelegramSubtitle => 'Bot token and parent messages';

  @override
  String get morePrinter => 'Printer';

  @override
  String get morePrinterSubtitle => 'Print settings';

  @override
  String get moreBackup => 'Backup';

  @override
  String get moreBackupSubtitle => 'Backup and restore';

  @override
  String get moreSubjects => 'Subjects';

  @override
  String get moreSubjectsSubtitle => 'Subjects list and prices';

  @override
  String get moreUsers => 'Users';

  @override
  String get moreUsersSubtitle => 'Accounts and roles';

  @override
  String get moreSettings => 'Settings';

  @override
  String get moreSettingsSubtitle => 'Language, theme, security';

  @override
  String get dashboardRecentRegistered => 'Recently registered';

  @override
  String get dashboardLive => 'Live';

  @override
  String get dashboardTotal => 'Total';

  @override
  String get dashboardFace => 'Face';

  @override
  String get dashboardManual => 'Manual';

  @override
  String get dashboardTodayNotMarked => 'Today\'s attendance not marked yet';

  @override
  String get dashboardMarkAttendance => 'Mark attendance';

  @override
  String get dashboardUpcomingLessons => 'Upcoming lessons';

  @override
  String get dashboardNoLessonsToday => 'No lessons scheduled today';

  @override
  String get dashboardLessonsDone => 'Today\'s lessons are done';

  @override
  String get dashboardTotalDebt => 'Total debt';

  @override
  String get dashboardNoDebts => 'No debts';

  @override
  String get dashboardOverdue => 'Overdue';

  @override
  String get dashboardNothingRegistered => 'No one registered yet';

  @override
  String get attendanceFaceIdTitle => 'Face ID — face recognition';

  @override
  String get attendanceFaceIdDesc =>
      'Automatic attendance via Hikvision camera';

  @override
  String get attendanceNoStudents => 'Register students first';

  @override
  String get attendanceMarkedToday => 'Marked today';

  @override
  String get attendanceViaFace => 'Via face';

  @override
  String get attendanceRecords => 'records';

  @override
  String get attendanceMarkManual => 'Mark manually';

  @override
  String get attendanceGroupless => 'No group';

  @override
  String get attendanceGroup => 'Group:';

  @override
  String get attendanceStatus => 'Attendance status';

  @override
  String get attendanceStatusEdit => 'Edit attendance status';

  @override
  String get settingsGeneral => 'General';

  @override
  String get settingsSecurity => 'Security';

  @override
  String get settingsNotificationsInApp => 'In-app notifications';

  @override
  String get settingsPushDesc => 'Push notifications to device';

  @override
  String get settingsSmsDesc => 'Send via SMS';

  @override
  String get settingsTelegramDesc => 'Send via Telegram';

  @override
  String get settingsAutoBackup => 'Automatic backup';

  @override
  String get settingsAutoBackupDesc => 'Create backups regularly';

  @override
  String get settingsIntervalDays => 'Interval (days)';

  @override
  String get settingsLastBackup => 'Last backup';

  @override
  String get settingsCreateBackup => 'Create backup';

  @override
  String get settingsCreateBackupDesc => 'All data is fully backed up';

  @override
  String get settingsRestore => 'Restore from backup';

  @override
  String get settingsRestoreDesc => 'Restore all data from a backup file';

  @override
  String get settingsGlassIntensity => 'Glass intensity';

  @override
  String get settingsDesign => 'Design';

  @override
  String get settingsUsersManage => 'Manage users';

  @override
  String get settingsUsersManageDesc =>
      'Roles, statuses, audit history — full control';

  @override
  String get settingsSubjectsEmpty => 'No subjects added yet';

  @override
  String get settingsSubjectAdd => 'Add subject';

  @override
  String get settingsNoUsersYet => 'No users yet';

  @override
  String get settingsVersion => 'Version';

  @override
  String get settingsBiometricOn => 'Biometric login enabled ✓';

  @override
  String get settingsBiometricOff => 'Biometric login disabled';

  @override
  String get settingsBiometricVerifyFail =>
      'Biometrics not confirmed — setting unchanged';

  @override
  String get registerTitleCreate => 'Create a new account';

  @override
  String get registerInfoPrompt => 'Enter your details';

  @override
  String get registerFirstName => 'Your name';

  @override
  String get registerConfirmRequired => 'Re-enter your password';

  @override
  String get registerMismatch => 'Passwords do not match';

  @override
  String get settingsPush => 'Push notifications';

  @override
  String get moreGrades => 'Grades';

  @override
  String get moreGradesSubtitle => 'Student performance';

  @override
  String get gradesTitle => 'Grades';

  @override
  String get gradesAdd => 'Add grade';

  @override
  String get gradesRating => 'Student rating';

  @override
  String get gradesStudents => 'students';

  @override
  String get gradesAverage => 'average';

  @override
  String get gradesTotal => 'grades';

  @override
  String get gradesCount => 'grades';

  @override
  String get gradesAverageShort => 'avg';

  @override
  String get gradesEmptyTitle => 'No grades yet';

  @override
  String get gradesEmptyDesc =>
      'Grade students by subject and build a performance rating.';

  @override
  String get gradesStudent => 'Student';

  @override
  String get gradesSelectStudent => 'Select a student';

  @override
  String get gradesSubject => 'Subject';

  @override
  String get gradesSelectSubject => 'Select a subject';

  @override
  String get gradesDate => 'Date';

  @override
  String get gradesValue => 'Grade';

  @override
  String get gradesComment => 'Comment';

  @override
  String get gradesCommentHint => 'e.g. Participated actively in class';

  @override
  String get gradesSaved => 'Grade saved ✓';

  @override
  String get commonSave => 'Save';

  @override
  String get navGroups => 'Groups';

  @override
  String get navFinance => 'Finance';

  @override
  String get navReports => 'Reports';

  @override
  String get navSettings => 'Settings';

  @override
  String get navProfile => 'Profile';

  @override
  String get navPrimary => 'Primary';

  @override
  String get navSecondary => 'Secondary';

  @override
  String get navHomework => 'Homework';

  @override
  String get shellBrandSubtitle => 'Education operations platform';

  @override
  String get actionCollapse => 'Collapse';

  @override
  String get actionExpand => 'Expand';

  @override
  String get syncStatusLocal => 'Local';

  @override
  String get syncStatusLocalTooltip =>
      'Data is stored on this device (offline-first)';

  @override
  String get notFoundTitle => 'Page not found';

  @override
  String get notFoundDesc =>
      'The requested page does not exist or has been moved.';

  @override
  String get notFoundGoHome => 'Go to home';

  @override
  String get moreCrm => 'CRM — Leads';

  @override
  String get moreCrmSubtitle => 'Kanban pipeline and conversion';

  @override
  String get crmTitle => 'CRM — Lead Pipeline';

  @override
  String get crmNewLead => 'New lead';

  @override
  String get crmSearchPlaceholder => 'Search by name, phone or email...';

  @override
  String get crmNoSearchResults => 'No results found';

  @override
  String get crmEmptyStage => 'No leads in this stage';

  @override
  String get crmStageNew => 'New';

  @override
  String get crmStageContacted => 'Contacted';

  @override
  String get crmStageTrial => 'Trial scheduled';

  @override
  String get crmStageConverted => 'Converted';

  @override
  String get crmStageLost => 'Lost';

  @override
  String get crmFullName => 'Full name';

  @override
  String get crmPhone => 'Phone number';

  @override
  String get crmEmail => 'Email';

  @override
  String get crmSource => 'Source';

  @override
  String get crmNotes => 'Notes';

  @override
  String get crmAssign => 'Assignee';

  @override
  String get crmSave => 'Save';

  @override
  String get crmCancel => 'Cancel';

  @override
  String get crmLeadDetails => 'Edit lead details';

  @override
  String get crmCreatedAt => 'Created';

  @override
  String get crmScoreBreakdown => 'Score breakdown';

  @override
  String get crmScore => 'Score';

  @override
  String get crmFollowUpAt => 'Next follow-up';

  @override
  String get crmScheduleFollowUp => 'Schedule follow-up';

  @override
  String get crmConvertToStudent => 'Convert to student';

  @override
  String get crmConvertTitle => 'Register lead as student';

  @override
  String get crmConvertLastName => 'Last name';

  @override
  String get crmMarkLost => 'Mark as lost';

  @override
  String get crmLostReason => 'Loss reason';

  @override
  String get crmLostReasonRequired => 'Reason is required';

  @override
  String get crmActivityTimeline => 'Activity timeline';

  @override
  String get crmCaptureSuccess => 'Lead captured';

  @override
  String get crmDuplicatesFound => 'Similar leads already exist';

  @override
  String get crmStage => 'Stage';

  @override
  String get crmEdit => 'Edit';

  @override
  String get loginGoogle => 'Sign in with Google';

  @override
  String get loginGoogleLoading => 'Signing in with Google…';

  @override
  String get loginGoogleCancelled => 'Google sign-in was cancelled';

  @override
  String get loginGoogleNotRegistered =>
      'This Google account is not registered — contact your administrator';

  @override
  String get loginGoogleDisabled =>
      'Account is disabled — contact your administrator';

  @override
  String get loginGoogleError => 'Google sign-in failed';

  @override
  String get syncStatusOffline => 'Offline';

  @override
  String get syncStatusSyncing => 'Syncing…';

  @override
  String get syncStatusSynced => 'Synced';

  @override
  String get syncStatusConflict => 'Conflict — administrator review required';

  @override
  String get syncStatusFailed => 'Sync failed';

  @override
  String get splashAuthTimeout => 'Authentication took too long.';

  @override
  String get databaseErrorTitle => 'Database error';

  @override
  String get databaseErrorDescription =>
      'An error occurred while starting the application. The database could not be opened.';

  @override
  String get splashTagline =>
      'When education is quality, the future is bright.';

  @override
  String get paymentsTitle => 'Payments';

  @override
  String get paymentsAdd => 'Receive payment';

  @override
  String get debtsTitle => 'Debts';

  @override
  String get debtsEmpty => 'No overdue debts';

  @override
  String get expensesTitle => 'Expenses';

  @override
  String get expensesAdd => 'Add expense';

  @override
  String get attendanceAddStudent => 'Add student';

  @override
  String get identityRegister => 'Register new person';

  @override
  String get identityFirstAdd => 'Add first person';

  @override
  String get identityScanTitle => 'QR Scanner';

  @override
  String get studentDeleteTitle => 'Delete student';

  @override
  String get studentDeleteConfirm => 'Delete';

  @override
  String get studentDeleteSuccess => 'Student deleted ✓';

  @override
  String get studentSaveError => 'Error saving';

  @override
  String get student360Title => 'Student 360';

  @override
  String get studentNoAttendanceStats => 'No attendance statistics available';

  @override
  String get studentNoPayments => 'No payment history';

  @override
  String get studentNotInGroup => 'Not assigned to a group';

  @override
  String get studentNotFromCrm => 'Not from CRM';

  @override
  String get studentNoEvents => 'No events';

  @override
  String get studentNotFound => 'Student not found';

  @override
  String get faceManualAttendance => 'Manual attendance';

  @override
  String get faceNoActiveLesson => 'No active lesson — attendance not marked';

  @override
  String get faceNoStudentsInGroup => 'No students in this lesson\'s group';

  @override
  String get faceManualMarkTitle => 'Manual marking';

  @override
  String get groupAddSubject => 'Select subject';

  @override
  String get groupAddTeacher => 'Select teacher';

  @override
  String get groupTeacherError => 'Teachers error';

  @override
  String get groupAddStudentSuccess => 'Student added to group ✓';

  @override
  String get groupAddStudentRegister => 'Register student';

  @override
  String get subjectAddTitle => 'Add subject';

  @override
  String get pinLockTitle => 'Enter PIN to continue';

  @override
  String get pinLockMinDigits => 'Enter at least 4 digits';

  @override
  String pinLockTooManyAttempts(Object seconds) {
    return 'Too many incorrect attempts. Try again in $seconds seconds.';
  }

  @override
  String get pinLockIncorrect => 'Incorrect PIN';

  @override
  String get pinSetupTitleSet => 'Set PIN';

  @override
  String get pinSetupTitleChange => 'Change PIN';

  @override
  String get pinSetupEnable => 'PIN lock enabled';

  @override
  String get pinSetupEnableDesc => 'PIN required on app launch';

  @override
  String get pinSetupDisable => 'PIN lock disabled';

  @override
  String get pinSetupDisableDesc => 'PIN not required on launch';

  @override
  String get pinSetupEnterNew => 'Enter new PIN:';

  @override
  String get pinSetupEnterPin => 'Enter PIN:';

  @override
  String get pinSetupConfirm => 'Confirm PIN:';

  @override
  String get pinSetupDigitsHint => '4-6 digits';

  @override
  String get pinSetupSaved => 'PIN set successfully';

  @override
  String get pinSetupRemoved => 'PIN removed';

  @override
  String get pinSetupEnterCurrent => 'Enter current PIN';

  @override
  String get pinSetupSetButton => 'Set PIN';

  @override
  String get pinSetupRemoveButton => 'Remove PIN';

  @override
  String get attendanceHistoryTitle => 'Attendance History';

  @override
  String get attendanceLoadError => 'Error loading data.';

  @override
  String get attendanceNoRecordsForPeriod =>
      'No attendance records for the selected period';

  @override
  String get attendanceExpandOrClearFilters =>
      'Expand the date range or clear filters.';

  @override
  String get attendanceClearFilters => 'Clear Filters';

  @override
  String get attendanceAllGroups => 'All Groups';

  @override
  String get attendanceSearchHint => 'Search by student name...';

  @override
  String get attendanceTodayRange => 'Today';

  @override
  String get attendance7Days => '7 days';

  @override
  String get attendance30Days => '30 days';

  @override
  String get attendanceThisMonth => 'This Month';

  @override
  String get attendanceSummaryTotal => 'Total';

  @override
  String get attendanceAveragePercent => 'Average Attendance';

  @override
  String get attendanceRecordsCount => 'records';

  @override
  String get attendanceRemaining => 'pending';

  @override
  String get attendanceMarkedCount => 'attended';

  @override
  String get attendanceEditedBadge => 'Edited';

  @override
  String get attendancePendingLabel => 'Pending';

  @override
  String get attendanceScheduledLabel => 'Scheduled';

  @override
  String get attendanceMarkedLabel => 'Marked';

  @override
  String get attendanceCenterTitle => 'Attendance Center';

  @override
  String get attendancePrevDay => 'Previous Day';

  @override
  String get attendanceNextDay => 'Next Day';

  @override
  String get attendanceFutureDateWarning =>
      'Future date — attendance cannot be marked';

  @override
  String get attendanceSummaryMarked => 'Marked:';

  @override
  String get attendanceLessonDefault => 'Lesson';

  @override
  String get attendanceSelectFilter => 'Filter';

  @override
  String get attendanceFilterAllActions => 'All Actions';

  @override
  String get attendanceFilterActionType => 'Action Type';

  @override
  String get attendanceMarkAllPresent => 'All Present';

  @override
  String get attendanceAllLessonMarked => 'All students marked';

  @override
  String get attendanceNoStudentsInGroup => 'No students in group';

  @override
  String get attendanceLessonNotStarted => 'Lesson not started yet';

  @override
  String get attendanceLessonNotStartedDetail =>
      'Attendance can be marked when lesson time begins';

  @override
  String get financeTotalIncome => 'Total Income';

  @override
  String get financeTotalExpense => 'Total Expense';

  @override
  String get financeThisMonth => 'This Month';

  @override
  String get financeLast6Months => 'Last 6 Months';

  @override
  String get financeCurrentBalance => 'Current Balance';

  @override
  String get financeProfit => 'Profit (Income > Expense)';

  @override
  String get financeLoss => 'Loss (Expense > Income)';

  @override
  String get financeExpense => 'Expense';

  @override
  String get financeIncome => 'Income';

  @override
  String get monthJan => 'Jan';

  @override
  String get monthFeb => 'Feb';

  @override
  String get monthMar => 'Mar';

  @override
  String get monthApr => 'Apr';

  @override
  String get monthMay => 'May';

  @override
  String get monthJun => 'Jun';

  @override
  String get monthJul => 'Jul';

  @override
  String get monthAug => 'Aug';

  @override
  String get monthSep => 'Sep';

  @override
  String get monthOct => 'Oct';

  @override
  String get monthNov => 'Nov';

  @override
  String get monthDec => 'Dec';

  @override
  String get paymentStatusCompleted => 'Completed';

  @override
  String get paymentStatusPending => 'Pending';

  @override
  String get paymentStatusFailed => 'Failed';

  @override
  String get paymentStatusRefunded => 'Refunded';

  @override
  String get paymentStatusCancelled => 'Cancelled';

  @override
  String get paymentSearchHint => 'Receipt, student or group...';

  @override
  String get paymentFilterAll => 'All';

  @override
  String get paymentFilterCash => 'Cash';

  @override
  String get paymentFilterCard => 'Card';

  @override
  String get paymentFilterTransfer => 'Transfer';

  @override
  String get paymentTotalCollected => 'Total Collected';

  @override
  String get paymentMonthly => 'Monthly';

  @override
  String get debtNoOverdue => 'No overdue debts';

  @override
  String get expenseNoData => 'No expenses';

  @override
  String get expenseAddSuccess => 'Expense added ✓';

  @override
  String get paymentAddSuccess => 'Payment received ✓';

  @override
  String get teacherEmptyTitle => 'No teachers yet';

  @override
  String get teacherEmptyDesc => 'Register the first teacher.';

  @override
  String get teacherSearchHint => 'Search by name, ID or specialization...';

  @override
  String get teacherSpecializationUndefined => 'No specialization set';

  @override
  String get groupNoStudents => 'No students in group';

  @override
  String get groupNoLessons => 'No lessons in this group';

  @override
  String get groupAvailableSlots => 'slots available';

  @override
  String get groupCapacityFull => 'Group is full';

  @override
  String get groupAddStudentTitle => 'Add Student to Group';

  @override
  String get groupNoUnassigned => 'All students are assigned to groups';

  @override
  String get groupRegisterFirst =>
      'Register a student first, then add to group.';

  @override
  String get groupSelectUnassigned => 'Select an unassigned student';
}
