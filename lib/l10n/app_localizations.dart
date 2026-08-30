import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ru'),
    Locale('uz')
  ];

  /// No description provided for @appTitle.
  ///
  /// In uz, this message translates to:
  /// **'M-Edu'**
  String get appTitle;

  /// No description provided for @navHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifa'**
  String get navHome;

  /// No description provided for @navStudents.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchilar'**
  String get navStudents;

  /// No description provided for @navTeachers.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchilar'**
  String get navTeachers;

  /// No description provided for @navAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Davomat'**
  String get navAttendance;

  /// No description provided for @navSchedule.
  ///
  /// In uz, this message translates to:
  /// **'Jadval'**
  String get navSchedule;

  /// No description provided for @navMore.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'proq'**
  String get navMore;

  /// No description provided for @actionSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get actionSave;

  /// No description provided for @actionCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get actionCancel;

  /// No description provided for @actionDelete.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirish'**
  String get actionDelete;

  /// No description provided for @actionAdd.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shish'**
  String get actionAdd;

  /// No description provided for @actionEdit.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash'**
  String get actionEdit;

  /// No description provided for @actionSearch.
  ///
  /// In uz, this message translates to:
  /// **'Qidirish'**
  String get actionSearch;

  /// No description provided for @actionConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get actionConfirm;

  /// No description provided for @actionBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get actionBack;

  /// No description provided for @actionClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get actionClose;

  /// No description provided for @actionSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get actionSend;

  /// No description provided for @actionRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get actionRetry;

  /// No description provided for @commonLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda...'**
  String get commonLoading;

  /// No description provided for @commonEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumot yo\'q'**
  String get commonEmpty;

  /// No description provided for @commonError.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get commonError;

  /// No description provided for @commonNoResults.
  ///
  /// In uz, this message translates to:
  /// **'Hech narsa topilmadi'**
  String get commonNoResults;

  /// No description provided for @commonAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get commonAll;

  /// No description provided for @dashboardTitle.
  ///
  /// In uz, this message translates to:
  /// **'Boshqaruv paneli'**
  String get dashboardTitle;

  /// No description provided for @dashboardTodayAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi davomat'**
  String get dashboardTodayAttendance;

  /// No description provided for @dashboardActiveStudents.
  ///
  /// In uz, this message translates to:
  /// **'Faol talabalar'**
  String get dashboardActiveStudents;

  /// No description provided for @dashboardTotalCollected.
  ///
  /// In uz, this message translates to:
  /// **'Jami yig\'ilgan'**
  String get dashboardTotalCollected;

  /// No description provided for @dashboardDebtors.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorlar'**
  String get dashboardDebtors;

  /// No description provided for @dashboardQuickActions.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor amallar'**
  String get dashboardQuickActions;

  /// No description provided for @dashboardRecentActivity.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi faoliyat'**
  String get dashboardRecentActivity;

  /// No description provided for @studentsTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchilar'**
  String get studentsTitle;

  /// No description provided for @studentsAdd.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi qo\'shish'**
  String get studentsAdd;

  /// No description provided for @studentsActive.
  ///
  /// In uz, this message translates to:
  /// **'Faol'**
  String get studentsActive;

  /// No description provided for @studentsArchived.
  ///
  /// In uz, this message translates to:
  /// **'Arxivlangan'**
  String get studentsArchived;

  /// No description provided for @studentsFrozen.
  ///
  /// In uz, this message translates to:
  /// **'Muzlatilgan'**
  String get studentsFrozen;

  /// No description provided for @studentsGraduated.
  ///
  /// In uz, this message translates to:
  /// **'Bitirgan'**
  String get studentsGraduated;

  /// No description provided for @studentsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha o\'quvchilar yo\'q'**
  String get studentsEmpty;

  /// No description provided for @teachersTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchilar'**
  String get teachersTitle;

  /// No description provided for @teachersAdd.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchi qo\'shish'**
  String get teachersAdd;

  /// No description provided for @groupsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Guruhlar'**
  String get groupsTitle;

  /// No description provided for @groupsAdd.
  ///
  /// In uz, this message translates to:
  /// **'Guruh yaratish'**
  String get groupsAdd;

  /// No description provided for @attendanceTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davomat'**
  String get attendanceTitle;

  /// No description provided for @attendanceMark.
  ///
  /// In uz, this message translates to:
  /// **'Belgilash'**
  String get attendanceMark;

  /// No description provided for @attendancePresent.
  ///
  /// In uz, this message translates to:
  /// **'Kelgan'**
  String get attendancePresent;

  /// No description provided for @attendanceLate.
  ///
  /// In uz, this message translates to:
  /// **'Kechikkan'**
  String get attendanceLate;

  /// No description provided for @attendanceAbsent.
  ///
  /// In uz, this message translates to:
  /// **'Kelmagan'**
  String get attendanceAbsent;

  /// No description provided for @attendanceExcused.
  ///
  /// In uz, this message translates to:
  /// **'Uzrli'**
  String get attendanceExcused;

  /// No description provided for @attendanceToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi davomat'**
  String get attendanceToday;

  /// No description provided for @attendanceHistory.
  ///
  /// In uz, this message translates to:
  /// **'Davomat tarixi'**
  String get attendanceHistory;

  /// No description provided for @financeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Moliya'**
  String get financeTitle;

  /// No description provided for @financeBalance.
  ///
  /// In uz, this message translates to:
  /// **'Balans'**
  String get financeBalance;

  /// No description provided for @financePayments.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar tarixi'**
  String get financePayments;

  /// No description provided for @financeNewPayment.
  ///
  /// In uz, this message translates to:
  /// **'Yangi to\'lov'**
  String get financeNewPayment;

  /// No description provided for @financeExpenses.
  ///
  /// In uz, this message translates to:
  /// **'Xarajatlar'**
  String get financeExpenses;

  /// No description provided for @financeDebts.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorliklar'**
  String get financeDebts;

  /// No description provided for @financeNewExpense.
  ///
  /// In uz, this message translates to:
  /// **'Yangi xarajat'**
  String get financeNewExpense;

  /// No description provided for @reportsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisobotlar'**
  String get reportsTitle;

  /// No description provided for @reportsStudentStats.
  ///
  /// In uz, this message translates to:
  /// **'Talaba statistikasi'**
  String get reportsStudentStats;

  /// No description provided for @reportsMonthlyAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Oylik davomat'**
  String get reportsMonthlyAttendance;

  /// No description provided for @reportsRevenue.
  ///
  /// In uz, this message translates to:
  /// **'Daromadlar'**
  String get reportsRevenue;

  /// No description provided for @reportsDebts.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorliklar'**
  String get reportsDebts;

  /// No description provided for @scheduleTitle.
  ///
  /// In uz, this message translates to:
  /// **'Dars jadvali'**
  String get scheduleTitle;

  /// No description provided for @scheduleRooms.
  ///
  /// In uz, this message translates to:
  /// **'Xonalar'**
  String get scheduleRooms;

  /// No description provided for @scheduleNoLessons.
  ///
  /// In uz, this message translates to:
  /// **'Bu kunga darslar rejalashtirilmagan'**
  String get scheduleNoLessons;

  /// No description provided for @scheduleAddLesson.
  ///
  /// In uz, this message translates to:
  /// **'Dars qo\'shish'**
  String get scheduleAddLesson;

  /// No description provided for @settingsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get settingsTitle;

  /// No description provided for @settingsLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get settingsLanguage;

  /// No description provided for @settingsTheme.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get settingsTheme;

  /// No description provided for @settingsThemeLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\''**
  String get settingsThemeLight;

  /// No description provided for @settingsThemeDark.
  ///
  /// In uz, this message translates to:
  /// **'Qorong\'u'**
  String get settingsThemeDark;

  /// No description provided for @settingsThemeSystem.
  ///
  /// In uz, this message translates to:
  /// **'Tizim'**
  String get settingsThemeSystem;

  /// No description provided for @settingsNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get settingsNotifications;

  /// No description provided for @settingsBiometric.
  ///
  /// In uz, this message translates to:
  /// **'Barmoq izi bilan kirish'**
  String get settingsBiometric;

  /// No description provided for @settingsVibration.
  ///
  /// In uz, this message translates to:
  /// **'Tebranish'**
  String get settingsVibration;

  /// No description provided for @settingsSms.
  ///
  /// In uz, this message translates to:
  /// **'SMS yuborish'**
  String get settingsSms;

  /// No description provided for @settingsTelegram.
  ///
  /// In uz, this message translates to:
  /// **'Telegram'**
  String get settingsTelegram;

  /// No description provided for @gamificationTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'yinlashtirish'**
  String get gamificationTitle;

  /// No description provided for @gamificationPoints.
  ///
  /// In uz, this message translates to:
  /// **'ball'**
  String get gamificationPoints;

  /// No description provided for @gamificationLevel.
  ///
  /// In uz, this message translates to:
  /// **'DARaja'**
  String get gamificationLevel;

  /// No description provided for @gamificationAchievements.
  ///
  /// In uz, this message translates to:
  /// **'Yutuqlar'**
  String get gamificationAchievements;

  /// No description provided for @gamificationNextLevel.
  ///
  /// In uz, this message translates to:
  /// **'Keyingi daraja'**
  String get gamificationNextLevel;

  /// No description provided for @gamificationMaxLevel.
  ///
  /// In uz, this message translates to:
  /// **'Maksimal daraja'**
  String get gamificationMaxLevel;

  /// No description provided for @identityTitle.
  ///
  /// In uz, this message translates to:
  /// **'ID Shaxslar'**
  String get identityTitle;

  /// No description provided for @identityAdd.
  ///
  /// In uz, this message translates to:
  /// **'Shaxs qo\'shish'**
  String get identityAdd;

  /// No description provided for @identityScan.
  ///
  /// In uz, this message translates to:
  /// **'QR skaner'**
  String get identityScan;

  /// No description provided for @notificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get notificationsTitle;

  /// No description provided for @notificationsSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get notificationsSend;

  /// No description provided for @moreTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'proq'**
  String get moreTitle;

  /// No description provided for @moreFinance.
  ///
  /// In uz, this message translates to:
  /// **'Moliya'**
  String get moreFinance;

  /// No description provided for @moreReports.
  ///
  /// In uz, this message translates to:
  /// **'Hisobotlar'**
  String get moreReports;

  /// No description provided for @moreManagement.
  ///
  /// In uz, this message translates to:
  /// **'Boshqaruv'**
  String get moreManagement;

  /// No description provided for @moreConnections.
  ///
  /// In uz, this message translates to:
  /// **'Ulanishlar'**
  String get moreConnections;

  /// No description provided for @moreSystem.
  ///
  /// In uz, this message translates to:
  /// **'Tizim'**
  String get moreSystem;

  /// No description provided for @loginTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get loginTitle;

  /// No description provided for @loginPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqam'**
  String get loginPhone;

  /// No description provided for @loginPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol'**
  String get loginPassword;

  /// No description provided for @loginButton.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get loginButton;

  /// No description provided for @registerTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get registerTitle;

  /// No description provided for @dialogConfirmDeleteTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirishni tasdiqlang'**
  String get dialogConfirmDeleteTitle;

  /// No description provided for @dialogConfirmDeleteBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu amalni ortga qaytarib bo\'lmaydi. Davom etasizmi?'**
  String get dialogConfirmDeleteBody;

  /// No description provided for @dialogDeleteStudent.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi o\'chirilsinmi?'**
  String get dialogDeleteStudent;

  /// No description provided for @dialogDeleteTeacher.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchi o\'chirilsinmi?'**
  String get dialogDeleteTeacher;

  /// No description provided for @loginEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get loginEmail;

  /// No description provided for @loginEmailHint.
  ///
  /// In uz, this message translates to:
  /// **'info@medu.uz'**
  String get loginEmailHint;

  /// No description provided for @loginEmailRequired.
  ///
  /// In uz, this message translates to:
  /// **'Email kiriting'**
  String get loginEmailRequired;

  /// No description provided for @loginEmailInvalid.
  ///
  /// In uz, this message translates to:
  /// **'To\'g\'ri email kiriting'**
  String get loginEmailInvalid;

  /// No description provided for @loginPasswordRequired.
  ///
  /// In uz, this message translates to:
  /// **'Parolni kiriting'**
  String get loginPasswordRequired;

  /// No description provided for @loginPasswordShort.
  ///
  /// In uz, this message translates to:
  /// **'Parol kamida 8 belgi, katta/kichik harf va raqam'**
  String get loginPasswordShort;

  /// No description provided for @loginBiometric.
  ///
  /// In uz, this message translates to:
  /// **'Biometrik bilan kirish'**
  String get loginBiometric;

  /// No description provided for @loginFaceId.
  ///
  /// In uz, this message translates to:
  /// **'Face ID bilan kirish'**
  String get loginFaceId;

  /// No description provided for @loginSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim Markazi Boshqaruvi Tizimi'**
  String get loginSubtitle;

  /// No description provided for @loginSecureNote.
  ///
  /// In uz, this message translates to:
  /// **'Hisoblar shu qurilmada shifrlangan holda saqlanadi.\nYolg\'on email bilan kirib bo\'lmaydi.'**
  String get loginSecureNote;

  /// No description provided for @loginNoAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz yo\'qmi? '**
  String get loginNoAccount;

  /// No description provided for @loginRegister.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get loginRegister;

  /// No description provided for @loginForgotPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni unutdingizmi?'**
  String get loginForgotPassword;

  /// No description provided for @loginForgotTitle.
  ///
  /// In uz, this message translates to:
  /// **'Parolni tiklash'**
  String get loginForgotTitle;

  /// No description provided for @loginForgotBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu qurilmadagi hisob paroli shifrlangan holda saqlanadi va uni qayta tiklab bo\'lmaydi. Administrator bilan bog\'laning yoki yangi hisob oching.'**
  String get loginForgotBody;

  /// No description provided for @loginErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kirish amalga oshmadi'**
  String get loginErrorTitle;

  /// No description provided for @loginLoadingLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kirish…'**
  String get loginLoadingLabel;

  /// No description provided for @loginDialogOk.
  ///
  /// In uz, this message translates to:
  /// **'Tushunarli'**
  String get loginDialogOk;

  /// No description provided for @registerName.
  ///
  /// In uz, this message translates to:
  /// **'Ism familiya'**
  String get registerName;

  /// No description provided for @registerNameRequired.
  ///
  /// In uz, this message translates to:
  /// **'Ismni kiriting'**
  String get registerNameRequired;

  /// No description provided for @registerEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get registerEmail;

  /// No description provided for @registerEmailInvalid.
  ///
  /// In uz, this message translates to:
  /// **'To\'g\'ri email kiriting'**
  String get registerEmailInvalid;

  /// No description provided for @registerPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol (kamida 8 belgi, A-z, 0-9)'**
  String get registerPassword;

  /// No description provided for @registerConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Parolni takrorlang'**
  String get registerConfirm;

  /// No description provided for @registerButton.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get registerButton;

  /// No description provided for @registerHaveAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz bormi? '**
  String get registerHaveAccount;

  /// No description provided for @registerLogin.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get registerLogin;

  /// No description provided for @registerSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi hisob — tizim egasi (Super Admin)'**
  String get registerSubtitle;

  /// No description provided for @moreAllSections.
  ///
  /// In uz, this message translates to:
  /// **'Barcha bo\'limlar va sozlamalar'**
  String get moreAllSections;

  /// No description provided for @morePayments.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar'**
  String get morePayments;

  /// No description provided for @morePaymentsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar tarixi va balans'**
  String get morePaymentsSubtitle;

  /// No description provided for @moreDebts.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorlik'**
  String get moreDebts;

  /// No description provided for @moreDebtsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan to\'lovlar'**
  String get moreDebtsSubtitle;

  /// No description provided for @moreNewPayment.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov qabul qilish'**
  String get moreNewPayment;

  /// No description provided for @moreNewPaymentSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Yangi to\'lovni qayd etish'**
  String get moreNewPaymentSubtitle;

  /// No description provided for @moreExpense.
  ///
  /// In uz, this message translates to:
  /// **'Xarajat'**
  String get moreExpense;

  /// No description provided for @moreExpenseSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Yangi xarajatni kiriting'**
  String get moreExpenseSubtitle;

  /// No description provided for @moreReportsCenter.
  ///
  /// In uz, this message translates to:
  /// **'Hisobotlar markazi'**
  String get moreReportsCenter;

  /// No description provided for @moreReportsCenterSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy hisobotlar sahifasi'**
  String get moreReportsCenterSubtitle;

  /// No description provided for @moreStudentStats.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi statistikasi'**
  String get moreStudentStats;

  /// No description provided for @moreStudentStatsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Har bir o\'quvchi bo\'yicha'**
  String get moreStudentStatsSubtitle;

  /// No description provided for @moreMonthlyAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Oylik davomat'**
  String get moreMonthlyAttendance;

  /// No description provided for @moreMonthlyAttendanceSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Oylik davomat hisoboti'**
  String get moreMonthlyAttendanceSubtitle;

  /// No description provided for @moreRevenue.
  ///
  /// In uz, this message translates to:
  /// **'Daromad'**
  String get moreRevenue;

  /// No description provided for @moreRevenueSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Daromadlar hisoboti'**
  String get moreRevenueSubtitle;

  /// No description provided for @moreDebtReport.
  ///
  /// In uz, this message translates to:
  /// **'Qarz hisoboti'**
  String get moreDebtReport;

  /// No description provided for @moreDebtReportSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorliklar bo\'yicha'**
  String get moreDebtReportSubtitle;

  /// No description provided for @moreTeachers.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchilar'**
  String get moreTeachers;

  /// No description provided for @moreTeachersSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchilar ro\'yxati'**
  String get moreTeachersSubtitle;

  /// No description provided for @moreGroups.
  ///
  /// In uz, this message translates to:
  /// **'Guruhlar'**
  String get moreGroups;

  /// No description provided for @moreGroupsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Guruhlar va tarkib'**
  String get moreGroupsSubtitle;

  /// No description provided for @moreRooms.
  ///
  /// In uz, this message translates to:
  /// **'Xonalar'**
  String get moreRooms;

  /// No description provided for @moreRoomsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'quv xonalari'**
  String get moreRoomsSubtitle;

  /// No description provided for @moreIdPersons.
  ///
  /// In uz, this message translates to:
  /// **'ID Shaxslar'**
  String get moreIdPersons;

  /// No description provided for @moreIdPersonsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Barcha ro\'yxatga olingan shaxslar'**
  String get moreIdPersonsSubtitle;

  /// No description provided for @moreNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get moreNotifications;

  /// No description provided for @moreNotificationsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Yuborilgan xabarlar'**
  String get moreNotificationsSubtitle;

  /// No description provided for @moreGamification.
  ///
  /// In uz, this message translates to:
  /// **'O\'yinlashtirish'**
  String get moreGamification;

  /// No description provided for @moreGamificationSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ballar, darajalar va yutuqlar'**
  String get moreGamificationSubtitle;

  /// No description provided for @moreFaceId.
  ///
  /// In uz, this message translates to:
  /// **'Face ID'**
  String get moreFaceId;

  /// No description provided for @moreFaceIdSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Hikvision kamera orqali davomat'**
  String get moreFaceIdSubtitle;

  /// No description provided for @moreQrScanner.
  ///
  /// In uz, this message translates to:
  /// **'QR skaner'**
  String get moreQrScanner;

  /// No description provided for @moreQrScannerSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'QR kod orqali tekshirish'**
  String get moreQrScannerSubtitle;

  /// No description provided for @moreTelegram.
  ///
  /// In uz, this message translates to:
  /// **'Telegram'**
  String get moreTelegram;

  /// No description provided for @moreTelegramSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Bot token va ota-ona xabarlari'**
  String get moreTelegramSubtitle;

  /// No description provided for @morePrinter.
  ///
  /// In uz, this message translates to:
  /// **'Printer'**
  String get morePrinter;

  /// No description provided for @morePrinterSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Chop etish sozlamalari'**
  String get morePrinterSubtitle;

  /// No description provided for @moreBackup.
  ///
  /// In uz, this message translates to:
  /// **'Zaxira nusxa'**
  String get moreBackup;

  /// No description provided for @moreBackupSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Backup va tiklash'**
  String get moreBackupSubtitle;

  /// No description provided for @moreSubjects.
  ///
  /// In uz, this message translates to:
  /// **'Fanlar'**
  String get moreSubjects;

  /// No description provided for @moreSubjectsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Fanlar ro\'yxati va narxlari'**
  String get moreSubjectsSubtitle;

  /// No description provided for @moreUsers.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchilar'**
  String get moreUsers;

  /// No description provided for @moreUsersSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisoblar va rollar'**
  String get moreUsersSubtitle;

  /// No description provided for @moreSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get moreSettings;

  /// No description provided for @moreSettingsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Til, mavzu, xavfsizlik'**
  String get moreSettingsSubtitle;

  /// No description provided for @dashboardRecentRegistered.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi ro\'yxatga olinganlar'**
  String get dashboardRecentRegistered;

  /// No description provided for @dashboardLive.
  ///
  /// In uz, this message translates to:
  /// **'Jonli'**
  String get dashboardLive;

  /// No description provided for @dashboardTotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get dashboardTotal;

  /// No description provided for @dashboardFace.
  ///
  /// In uz, this message translates to:
  /// **'Yuz'**
  String get dashboardFace;

  /// No description provided for @dashboardManual.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'lda'**
  String get dashboardManual;

  /// No description provided for @dashboardTodayNotMarked.
  ///
  /// In uz, this message translates to:
  /// **'Bugun hali davomat belgilanmagan'**
  String get dashboardTodayNotMarked;

  /// No description provided for @dashboardMarkAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Davomat belgilash'**
  String get dashboardMarkAttendance;

  /// No description provided for @dashboardUpcomingLessons.
  ///
  /// In uz, this message translates to:
  /// **'Yaqinlashib kelayotgan darslar'**
  String get dashboardUpcomingLessons;

  /// No description provided for @dashboardNoLessonsToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugun darslar rejalashtirilmagan'**
  String get dashboardNoLessonsToday;

  /// No description provided for @dashboardLessonsDone.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi darslar yakunlandi'**
  String get dashboardLessonsDone;

  /// No description provided for @dashboardTotalDebt.
  ///
  /// In uz, this message translates to:
  /// **'Jami qarz'**
  String get dashboardTotalDebt;

  /// No description provided for @dashboardNoDebts.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorliklar yo\'q'**
  String get dashboardNoDebts;

  /// No description provided for @dashboardOverdue.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan'**
  String get dashboardOverdue;

  /// No description provided for @dashboardNothingRegistered.
  ///
  /// In uz, this message translates to:
  /// **'Hali hech kim ro\'yxatdan o\'tkazilmagan'**
  String get dashboardNothingRegistered;

  /// No description provided for @attendanceFaceIdTitle.
  ///
  /// In uz, this message translates to:
  /// **'Face ID — yuzni tanish'**
  String get attendanceFaceIdTitle;

  /// No description provided for @attendanceFaceIdDesc.
  ///
  /// In uz, this message translates to:
  /// **'Hikvision kamera orqali davomatni avtomatik belgilash'**
  String get attendanceFaceIdDesc;

  /// No description provided for @attendanceNoStudents.
  ///
  /// In uz, this message translates to:
  /// **'Avval o\'quvchilarni ro\'yxatga oling'**
  String get attendanceNoStudents;

  /// No description provided for @attendanceMarkedToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugun belgilandi'**
  String get attendanceMarkedToday;

  /// No description provided for @attendanceViaFace.
  ///
  /// In uz, this message translates to:
  /// **'Face orqali'**
  String get attendanceViaFace;

  /// No description provided for @attendanceRecords.
  ///
  /// In uz, this message translates to:
  /// **'ta yozuv'**
  String get attendanceRecords;

  /// No description provided for @attendanceMarkManual.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'lda belgilash'**
  String get attendanceMarkManual;

  /// No description provided for @attendanceGroupless.
  ///
  /// In uz, this message translates to:
  /// **'Guruhsiz'**
  String get attendanceGroupless;

  /// No description provided for @attendanceGroup.
  ///
  /// In uz, this message translates to:
  /// **'Guruh:'**
  String get attendanceGroup;

  /// No description provided for @attendanceStatus.
  ///
  /// In uz, this message translates to:
  /// **'Davomat holati'**
  String get attendanceStatus;

  /// No description provided for @attendanceStatusEdit.
  ///
  /// In uz, this message translates to:
  /// **'Davomat holatini tahrirlash'**
  String get attendanceStatusEdit;

  /// No description provided for @settingsGeneral.
  ///
  /// In uz, this message translates to:
  /// **'Umumiy'**
  String get settingsGeneral;

  /// No description provided for @settingsSecurity.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizlik'**
  String get settingsSecurity;

  /// No description provided for @settingsNotificationsInApp.
  ///
  /// In uz, this message translates to:
  /// **'Ilova ichidagi bildirishnomalar'**
  String get settingsNotificationsInApp;

  /// No description provided for @settingsPushDesc.
  ///
  /// In uz, this message translates to:
  /// **'Qurilmaga push bildirishnomalar'**
  String get settingsPushDesc;

  /// No description provided for @settingsSmsDesc.
  ///
  /// In uz, this message translates to:
  /// **'SMS orqali yuborish'**
  String get settingsSmsDesc;

  /// No description provided for @settingsTelegramDesc.
  ///
  /// In uz, this message translates to:
  /// **'Telegram orqali yuborish'**
  String get settingsTelegramDesc;

  /// No description provided for @settingsAutoBackup.
  ///
  /// In uz, this message translates to:
  /// **'Avtomatik zaxira'**
  String get settingsAutoBackup;

  /// No description provided for @settingsAutoBackupDesc.
  ///
  /// In uz, this message translates to:
  /// **'Muntazam ravishda zaxira yaratish'**
  String get settingsAutoBackupDesc;

  /// No description provided for @settingsIntervalDays.
  ///
  /// In uz, this message translates to:
  /// **'Davr (kun)'**
  String get settingsIntervalDays;

  /// No description provided for @settingsLastBackup.
  ///
  /// In uz, this message translates to:
  /// **'Oxirgi zaxira'**
  String get settingsLastBackup;

  /// No description provided for @settingsCreateBackup.
  ///
  /// In uz, this message translates to:
  /// **'Zaxira yaratish'**
  String get settingsCreateBackup;

  /// No description provided for @settingsCreateBackupDesc.
  ///
  /// In uz, this message translates to:
  /// **'Barcha ma\'lumotlar to\'liq zaxiralanadi'**
  String get settingsCreateBackupDesc;

  /// No description provided for @settingsRestore.
  ///
  /// In uz, this message translates to:
  /// **'Zaxira\'dan tiklash'**
  String get settingsRestore;

  /// No description provided for @settingsRestoreDesc.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud zaxira faylidan barcha ma\'lumotlarni tiklash'**
  String get settingsRestoreDesc;

  /// No description provided for @settingsGlassIntensity.
  ///
  /// In uz, this message translates to:
  /// **'Glass intensity'**
  String get settingsGlassIntensity;

  /// No description provided for @settingsDesign.
  ///
  /// In uz, this message translates to:
  /// **'Dizayn'**
  String get settingsDesign;

  /// No description provided for @settingsUsersManage.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchilarni boshqarish'**
  String get settingsUsersManage;

  /// No description provided for @settingsUsersManageDesc.
  ///
  /// In uz, this message translates to:
  /// **'Rollar, holatlar, audit tarixi — to\'liq boshqaruv'**
  String get settingsUsersManageDesc;

  /// No description provided for @settingsSubjectsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali fanlar qo\'shilmagan'**
  String get settingsSubjectsEmpty;

  /// No description provided for @settingsSubjectAdd.
  ///
  /// In uz, this message translates to:
  /// **'Fan qo\'shish'**
  String get settingsSubjectAdd;

  /// No description provided for @settingsNoUsersYet.
  ///
  /// In uz, this message translates to:
  /// **'Hali foydalanuvchilar yo\'q'**
  String get settingsNoUsersYet;

  /// No description provided for @settingsVersion.
  ///
  /// In uz, this message translates to:
  /// **'Versiya'**
  String get settingsVersion;

  /// No description provided for @settingsBiometricOn.
  ///
  /// In uz, this message translates to:
  /// **'Biometrik kirish yoqildi ✓'**
  String get settingsBiometricOn;

  /// No description provided for @settingsBiometricOff.
  ///
  /// In uz, this message translates to:
  /// **'Biometrik kirish o\'chirildi'**
  String get settingsBiometricOff;

  /// No description provided for @settingsBiometricVerifyFail.
  ///
  /// In uz, this message translates to:
  /// **'Biometrik tasdiqlanmadi — sozlama o\'zgartirilmadi'**
  String get settingsBiometricVerifyFail;

  /// No description provided for @registerTitleCreate.
  ///
  /// In uz, this message translates to:
  /// **'Yangi hisob yarating'**
  String get registerTitleCreate;

  /// No description provided for @registerInfoPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlaringizni kiriting'**
  String get registerInfoPrompt;

  /// No description provided for @registerFirstName.
  ///
  /// In uz, this message translates to:
  /// **'Ismingiz'**
  String get registerFirstName;

  /// No description provided for @registerConfirmRequired.
  ///
  /// In uz, this message translates to:
  /// **'Parolni qaytadan kiriting'**
  String get registerConfirmRequired;

  /// No description provided for @registerMismatch.
  ///
  /// In uz, this message translates to:
  /// **'Parollar mos kelmaydi'**
  String get registerMismatch;

  /// No description provided for @settingsPush.
  ///
  /// In uz, this message translates to:
  /// **'Push bildirishnomalar'**
  String get settingsPush;

  /// No description provided for @moreGrades.
  ///
  /// In uz, this message translates to:
  /// **'Baholar'**
  String get moreGrades;

  /// No description provided for @moreGradesSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchilar o\'zlashtirishi'**
  String get moreGradesSubtitle;

  /// No description provided for @gradesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Baholar'**
  String get gradesTitle;

  /// No description provided for @gradesAdd.
  ///
  /// In uz, this message translates to:
  /// **'Baho qo\'shish'**
  String get gradesAdd;

  /// No description provided for @gradesRating.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchilar reytingi'**
  String get gradesRating;

  /// No description provided for @gradesStudents.
  ///
  /// In uz, this message translates to:
  /// **'o\'quvchi'**
  String get gradesStudents;

  /// No description provided for @gradesAverage.
  ///
  /// In uz, this message translates to:
  /// **'o\'rtacha'**
  String get gradesAverage;

  /// No description provided for @gradesTotal.
  ///
  /// In uz, this message translates to:
  /// **'baho'**
  String get gradesTotal;

  /// No description provided for @gradesCount.
  ///
  /// In uz, this message translates to:
  /// **'baho'**
  String get gradesCount;

  /// No description provided for @gradesAverageShort.
  ///
  /// In uz, this message translates to:
  /// **'o\'rt.'**
  String get gradesAverageShort;

  /// No description provided for @gradesEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hali baholar yo\'q'**
  String get gradesEmptyTitle;

  /// No description provided for @gradesEmptyDesc.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchilarga fanlar bo\'yicha baho qo\'yib, o\'zlashtirish reytingini shakllantiring.'**
  String get gradesEmptyDesc;

  /// No description provided for @gradesStudent.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi'**
  String get gradesStudent;

  /// No description provided for @gradesSelectStudent.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchini tanlang'**
  String get gradesSelectStudent;

  /// No description provided for @gradesSubject.
  ///
  /// In uz, this message translates to:
  /// **'Fan'**
  String get gradesSubject;

  /// No description provided for @gradesSelectSubject.
  ///
  /// In uz, this message translates to:
  /// **'Fanni tanlang'**
  String get gradesSelectSubject;

  /// No description provided for @gradesDate.
  ///
  /// In uz, this message translates to:
  /// **'Sana'**
  String get gradesDate;

  /// No description provided for @gradesValue.
  ///
  /// In uz, this message translates to:
  /// **'Baho'**
  String get gradesValue;

  /// No description provided for @gradesComment.
  ///
  /// In uz, this message translates to:
  /// **'Izoh'**
  String get gradesComment;

  /// No description provided for @gradesCommentHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: darsda faol ishtirok etdi'**
  String get gradesCommentHint;

  /// No description provided for @gradesSaved.
  ///
  /// In uz, this message translates to:
  /// **'Baho saqlandi ✓'**
  String get gradesSaved;

  /// No description provided for @commonSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get commonSave;

  /// No description provided for @navGroups.
  ///
  /// In uz, this message translates to:
  /// **'Guruhlar'**
  String get navGroups;

  /// No description provided for @navFinance.
  ///
  /// In uz, this message translates to:
  /// **'Moliya'**
  String get navFinance;

  /// No description provided for @navReports.
  ///
  /// In uz, this message translates to:
  /// **'Hisobotlar'**
  String get navReports;

  /// No description provided for @navSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get navSettings;

  /// No description provided for @navProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @navPrimary.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy'**
  String get navPrimary;

  /// No description provided for @navSecondary.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shimcha'**
  String get navSecondary;

  /// No description provided for @navHomework.
  ///
  /// In uz, this message translates to:
  /// **'Uy vazifalari'**
  String get navHomework;

  /// No description provided for @shellBrandSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim markazi boshqaruvi'**
  String get shellBrandSubtitle;

  /// No description provided for @actionCollapse.
  ///
  /// In uz, this message translates to:
  /// **'Yig\'ish'**
  String get actionCollapse;

  /// No description provided for @actionExpand.
  ///
  /// In uz, this message translates to:
  /// **'Kengaytirish'**
  String get actionExpand;

  /// No description provided for @syncStatusLocal.
  ///
  /// In uz, this message translates to:
  /// **'Lokal'**
  String get syncStatusLocal;

  /// No description provided for @syncStatusLocalTooltip.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar shu qurilmada saqlanadi (offline-first)'**
  String get syncStatusLocalTooltip;

  /// No description provided for @notFoundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sahifa topilmadi'**
  String get notFoundTitle;

  /// No description provided for @notFoundDesc.
  ///
  /// In uz, this message translates to:
  /// **'So\'ralgan sahifa mavjud emas yoki ko\'chirilgan.'**
  String get notFoundDesc;

  /// No description provided for @notFoundGoHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifaga qaytish'**
  String get notFoundGoHome;

  /// No description provided for @moreCrm.
  ///
  /// In uz, this message translates to:
  /// **'CRM — Leadlar'**
  String get moreCrm;

  /// No description provided for @moreCrmSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Kanban pipeline va konvertatsiya'**
  String get moreCrmSubtitle;

  /// No description provided for @crmTitle.
  ///
  /// In uz, this message translates to:
  /// **'CRM — Lead Pipeline'**
  String get crmTitle;

  /// No description provided for @crmNewLead.
  ///
  /// In uz, this message translates to:
  /// **'Yangi lead'**
  String get crmNewLead;

  /// No description provided for @crmSearchPlaceholder.
  ///
  /// In uz, this message translates to:
  /// **'Ism, telefon yoki email bo\'yicha qidirish...'**
  String get crmSearchPlaceholder;

  /// No description provided for @crmNoSearchResults.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruv bo\'yicha natija topilmadi'**
  String get crmNoSearchResults;

  /// No description provided for @crmEmptyStage.
  ///
  /// In uz, this message translates to:
  /// **'Bu bosqichda lead yo\'q'**
  String get crmEmptyStage;

  /// No description provided for @crmStageNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangi'**
  String get crmStageNew;

  /// No description provided for @crmStageContacted.
  ///
  /// In uz, this message translates to:
  /// **'Bog\'lanildi'**
  String get crmStageContacted;

  /// No description provided for @crmStageTrial.
  ///
  /// In uz, this message translates to:
  /// **'Sinov darsiga yozilgan'**
  String get crmStageTrial;

  /// No description provided for @crmStageConverted.
  ///
  /// In uz, this message translates to:
  /// **'Konvertatsiya qilingan'**
  String get crmStageConverted;

  /// No description provided for @crmStageLost.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qotilgan'**
  String get crmStageLost;

  /// No description provided for @crmFullName.
  ///
  /// In uz, this message translates to:
  /// **'To\'liq ism'**
  String get crmFullName;

  /// No description provided for @crmPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqami'**
  String get crmPhone;

  /// No description provided for @crmEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get crmEmail;

  /// No description provided for @crmSource.
  ///
  /// In uz, this message translates to:
  /// **'Manba'**
  String get crmSource;

  /// No description provided for @crmNotes.
  ///
  /// In uz, this message translates to:
  /// **'Izoh'**
  String get crmNotes;

  /// No description provided for @crmAssign.
  ///
  /// In uz, this message translates to:
  /// **'Mas\'ul'**
  String get crmAssign;

  /// No description provided for @crmSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get crmSave;

  /// No description provided for @crmCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get crmCancel;

  /// No description provided for @crmLeadDetails.
  ///
  /// In uz, this message translates to:
  /// **'Lead ma\'lumotlarini tahrirlash'**
  String get crmLeadDetails;

  /// No description provided for @crmCreatedAt.
  ///
  /// In uz, this message translates to:
  /// **'Yaratilgan'**
  String get crmCreatedAt;

  /// No description provided for @crmScoreBreakdown.
  ///
  /// In uz, this message translates to:
  /// **'Ball tahlili'**
  String get crmScoreBreakdown;

  /// No description provided for @crmScore.
  ///
  /// In uz, this message translates to:
  /// **'Ball'**
  String get crmScore;

  /// No description provided for @crmFollowUpAt.
  ///
  /// In uz, this message translates to:
  /// **'Keyingi aloqa'**
  String get crmFollowUpAt;

  /// No description provided for @crmScheduleFollowUp.
  ///
  /// In uz, this message translates to:
  /// **'Follow-up belgilash'**
  String get crmScheduleFollowUp;

  /// No description provided for @crmConvertToStudent.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchiga aylantirish'**
  String get crmConvertToStudent;

  /// No description provided for @crmConvertTitle.
  ///
  /// In uz, this message translates to:
  /// **'Lead\'ni o\'quvchi sifatida ro\'yxatdan o\'tkazish'**
  String get crmConvertTitle;

  /// No description provided for @crmConvertLastName.
  ///
  /// In uz, this message translates to:
  /// **'Familiya'**
  String get crmConvertLastName;

  /// No description provided for @crmMarkLost.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qotilgan deb belgilash'**
  String get crmMarkLost;

  /// No description provided for @crmLostReason.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'qotish sababi'**
  String get crmLostReason;

  /// No description provided for @crmLostReasonRequired.
  ///
  /// In uz, this message translates to:
  /// **'Sabab kiritilishi shart'**
  String get crmLostReasonRequired;

  /// No description provided for @crmActivityTimeline.
  ///
  /// In uz, this message translates to:
  /// **'Faoliyat tarixi'**
  String get crmActivityTimeline;

  /// No description provided for @crmCaptureSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Lead qo\'lga kiritildi'**
  String get crmCaptureSuccess;

  /// No description provided for @crmDuplicatesFound.
  ///
  /// In uz, this message translates to:
  /// **'O\'xshash leadlar allaqachon mavjud'**
  String get crmDuplicatesFound;

  /// No description provided for @crmStage.
  ///
  /// In uz, this message translates to:
  /// **'Bosqich'**
  String get crmStage;

  /// No description provided for @crmEdit.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash'**
  String get crmEdit;

  /// No description provided for @loginGoogle.
  ///
  /// In uz, this message translates to:
  /// **'Google bilan kirish'**
  String get loginGoogle;

  /// No description provided for @loginGoogleLoading.
  ///
  /// In uz, this message translates to:
  /// **'Google bilan kirish…'**
  String get loginGoogleLoading;

  /// No description provided for @loginGoogleCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Google kirish bekor qilindi'**
  String get loginGoogleCancelled;

  /// No description provided for @loginGoogleNotRegistered.
  ///
  /// In uz, this message translates to:
  /// **'Bu Google hisobi tizimda ro\'yxatdan o\'tmagan — administrator bilan bog\'laning'**
  String get loginGoogleNotRegistered;

  /// No description provided for @loginGoogleDisabled.
  ///
  /// In uz, this message translates to:
  /// **'Hisob bloklangan — administrator bilan bog\'laning'**
  String get loginGoogleDisabled;

  /// No description provided for @loginGoogleError.
  ///
  /// In uz, this message translates to:
  /// **'Google kirishda xatolik yuz berdi'**
  String get loginGoogleError;

  /// No description provided for @syncStatusOffline.
  ///
  /// In uz, this message translates to:
  /// **'Oflayn'**
  String get syncStatusOffline;

  /// No description provided for @syncStatusSyncing.
  ///
  /// In uz, this message translates to:
  /// **'Sinxronlanmoqda…'**
  String get syncStatusSyncing;

  /// No description provided for @syncStatusSynced.
  ///
  /// In uz, this message translates to:
  /// **'Sinxronlandi'**
  String get syncStatusSynced;

  /// No description provided for @syncStatusConflict.
  ///
  /// In uz, this message translates to:
  /// **'Ziddiyat — administrator ko\'rib chiqishi kerak'**
  String get syncStatusConflict;

  /// No description provided for @syncStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Sinxronlash xatosi'**
  String get syncStatusFailed;

  /// No description provided for @splashAuthTimeout.
  ///
  /// In uz, this message translates to:
  /// **'Autentifikatsiya juda uzoq davom etdi.'**
  String get splashAuthTimeout;

  /// No description provided for @databaseErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar bazasi xatosi'**
  String get databaseErrorTitle;

  /// No description provided for @databaseErrorDescription.
  ///
  /// In uz, this message translates to:
  /// **'Ilovani ishga tushirishda muammo yuz berdi. Ma\'lumotlar bazasi ochilmadi.'**
  String get databaseErrorDescription;

  /// No description provided for @splashTagline.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim sifatli bo\'lsa, kelajak yorqin bo\'ladi.'**
  String get splashTagline;

  /// No description provided for @paymentsTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar'**
  String get paymentsTitle;

  /// No description provided for @paymentsAdd.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov qabul qilish'**
  String get paymentsAdd;

  /// No description provided for @debtsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qarzdorliklar'**
  String get debtsTitle;

  /// No description provided for @debtsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan qarzlar yo\'q'**
  String get debtsEmpty;

  /// No description provided for @expensesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xarajatlar'**
  String get expensesTitle;

  /// No description provided for @expensesAdd.
  ///
  /// In uz, this message translates to:
  /// **'Xarajat qo\'shish'**
  String get expensesAdd;

  /// No description provided for @attendanceAddStudent.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi qo\'shish'**
  String get attendanceAddStudent;

  /// No description provided for @identityRegister.
  ///
  /// In uz, this message translates to:
  /// **'Yangi shaxsni ro\'yxatga olish'**
  String get identityRegister;

  /// No description provided for @identityFirstAdd.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi shaxsni qo\'shish'**
  String get identityFirstAdd;

  /// No description provided for @identityScanTitle.
  ///
  /// In uz, this message translates to:
  /// **'QR skanerlash'**
  String get identityScanTitle;

  /// No description provided for @studentDeleteTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchini o\'chirish'**
  String get studentDeleteTitle;

  /// No description provided for @studentDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirish'**
  String get studentDeleteConfirm;

  /// No description provided for @studentDeleteSuccess.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi o\'chirildi ✓'**
  String get studentDeleteSuccess;

  /// No description provided for @studentSaveError.
  ///
  /// In uz, this message translates to:
  /// **'Saqlashda xatolik yuz berdi'**
  String get studentSaveError;

  /// No description provided for @student360Title.
  ///
  /// In uz, this message translates to:
  /// **'Talaba 360'**
  String get student360Title;

  /// No description provided for @studentNoAttendanceStats.
  ///
  /// In uz, this message translates to:
  /// **'Davomat statistikasi mavjud emas'**
  String get studentNoAttendanceStats;

  /// No description provided for @studentNoPayments.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov tarixi yo\'q'**
  String get studentNoPayments;

  /// No description provided for @studentNotInGroup.
  ///
  /// In uz, this message translates to:
  /// **'Guruhga tayinlanmagan'**
  String get studentNotInGroup;

  /// No description provided for @studentNotFromCrm.
  ///
  /// In uz, this message translates to:
  /// **'CRM orqali kelmagan'**
  String get studentNotFromCrm;

  /// No description provided for @studentNoEvents.
  ///
  /// In uz, this message translates to:
  /// **'Hodisa yo\'q'**
  String get studentNoEvents;

  /// No description provided for @studentNotFound.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi topilmadi'**
  String get studentNotFound;

  /// No description provided for @faceManualAttendance.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'lda davomat'**
  String get faceManualAttendance;

  /// No description provided for @faceNoActiveLesson.
  ///
  /// In uz, this message translates to:
  /// **'Faol dars yo\'q — davomat belgilanmaydi'**
  String get faceNoActiveLesson;

  /// No description provided for @faceNoStudentsInGroup.
  ///
  /// In uz, this message translates to:
  /// **'Bu dars guruhida o\'quvchilar yo\'q'**
  String get faceNoStudentsInGroup;

  /// No description provided for @faceManualMarkTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'lda belgilash'**
  String get faceManualMarkTitle;

  /// No description provided for @groupAddSubject.
  ///
  /// In uz, this message translates to:
  /// **'Fan tanlang'**
  String get groupAddSubject;

  /// No description provided for @groupAddTeacher.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchi tanlang'**
  String get groupAddTeacher;

  /// No description provided for @groupTeacherError.
  ///
  /// In uz, this message translates to:
  /// **'O\'qituvchilar xatosi'**
  String get groupTeacherError;

  /// No description provided for @groupAddStudentSuccess.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi guruhga qo\'shildi ✓'**
  String get groupAddStudentSuccess;

  /// No description provided for @groupAddStudentRegister.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi ro\'yxatga olish'**
  String get groupAddStudentRegister;

  /// No description provided for @subjectAddTitle.
  ///
  /// In uz, this message translates to:
  /// **'Fan qo\'shish'**
  String get subjectAddTitle;

  /// No description provided for @pinLockTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish uchun PIN kiriting'**
  String get pinLockTitle;

  /// No description provided for @pinLockMinDigits.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 4 ta raqam kiriting'**
  String get pinLockMinDigits;

  /// No description provided for @pinLockTooManyAttempts.
  ///
  /// In uz, this message translates to:
  /// **'Juda ko\'p noto\'g\'ri urinish. {seconds} soniyadan keyin qayta urinib ko\'ring.'**
  String pinLockTooManyAttempts(Object seconds);

  /// No description provided for @pinLockIncorrect.
  ///
  /// In uz, this message translates to:
  /// **'Noto\'g\'ri PIN'**
  String get pinLockIncorrect;

  /// No description provided for @pinSetupTitleSet.
  ///
  /// In uz, this message translates to:
  /// **'PIN o\'rnatish'**
  String get pinSetupTitleSet;

  /// No description provided for @pinSetupTitleChange.
  ///
  /// In uz, this message translates to:
  /// **'PIN ni o\'zgartirish'**
  String get pinSetupTitleChange;

  /// No description provided for @pinSetupEnable.
  ///
  /// In uz, this message translates to:
  /// **'PIN blokirovka yoqilgan'**
  String get pinSetupEnable;

  /// No description provided for @pinSetupEnableDesc.
  ///
  /// In uz, this message translates to:
  /// **'Ilova ochilganda PIN so\'raladi'**
  String get pinSetupEnableDesc;

  /// No description provided for @pinSetupDisable.
  ///
  /// In uz, this message translates to:
  /// **'PIN blokirovka o\'chirilgan'**
  String get pinSetupDisable;

  /// No description provided for @pinSetupDisableDesc.
  ///
  /// In uz, this message translates to:
  /// **'Ilova ochilganda PIN so\'ralmaydi'**
  String get pinSetupDisableDesc;

  /// No description provided for @pinSetupEnterNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangi PIN kiriting:'**
  String get pinSetupEnterNew;

  /// No description provided for @pinSetupEnterPin.
  ///
  /// In uz, this message translates to:
  /// **'PIN kiriting:'**
  String get pinSetupEnterPin;

  /// No description provided for @pinSetupConfirm.
  ///
  /// In uz, this message translates to:
  /// **'PIN ni tasdiqlang:'**
  String get pinSetupConfirm;

  /// No description provided for @pinSetupDigitsHint.
  ///
  /// In uz, this message translates to:
  /// **'4-6 raqam'**
  String get pinSetupDigitsHint;

  /// No description provided for @pinSetupSaved.
  ///
  /// In uz, this message translates to:
  /// **'PIN muvaffaqiyatli o\'rnatildi'**
  String get pinSetupSaved;

  /// No description provided for @pinSetupRemoved.
  ///
  /// In uz, this message translates to:
  /// **'PIN o\'chirildi'**
  String get pinSetupRemoved;

  /// No description provided for @pinSetupEnterCurrent.
  ///
  /// In uz, this message translates to:
  /// **'Joriy PIN ni kiriting'**
  String get pinSetupEnterCurrent;

  /// No description provided for @pinSetupSetButton.
  ///
  /// In uz, this message translates to:
  /// **'PIN ni o\'rnatish'**
  String get pinSetupSetButton;

  /// No description provided for @pinSetupRemoveButton.
  ///
  /// In uz, this message translates to:
  /// **'PIN ni o\'chirish'**
  String get pinSetupRemoveButton;

  /// No description provided for @attendanceHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davomat tarixi'**
  String get attendanceHistoryTitle;

  /// No description provided for @attendanceLoadError.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni yuklashda xatolik yuz berdi.'**
  String get attendanceLoadError;

  /// No description provided for @attendanceNoRecordsForPeriod.
  ///
  /// In uz, this message translates to:
  /// **'Tanlangan davrda davomat yozuvi yo\'q'**
  String get attendanceNoRecordsForPeriod;

  /// No description provided for @attendanceExpandOrClearFilters.
  ///
  /// In uz, this message translates to:
  /// **'Sana oralig\'ini kengaytiring yoki filtrlarni tozalang.'**
  String get attendanceExpandOrClearFilters;

  /// No description provided for @attendanceClearFilters.
  ///
  /// In uz, this message translates to:
  /// **'Filtrni tozalash'**
  String get attendanceClearFilters;

  /// No description provided for @attendanceAllGroups.
  ///
  /// In uz, this message translates to:
  /// **'Barcha guruhlar'**
  String get attendanceAllGroups;

  /// No description provided for @attendanceSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'O\'quvchi ismi bo\'yicha qidirish...'**
  String get attendanceSearchHint;

  /// No description provided for @attendanceTodayRange.
  ///
  /// In uz, this message translates to:
  /// **'Bugun'**
  String get attendanceTodayRange;

  /// No description provided for @attendance7Days.
  ///
  /// In uz, this message translates to:
  /// **'7 kun'**
  String get attendance7Days;

  /// No description provided for @attendance30Days.
  ///
  /// In uz, this message translates to:
  /// **'30 kun'**
  String get attendance30Days;

  /// No description provided for @attendanceThisMonth.
  ///
  /// In uz, this message translates to:
  /// **'Bu oy'**
  String get attendanceThisMonth;

  /// No description provided for @attendanceSummaryTotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get attendanceSummaryTotal;

  /// No description provided for @attendanceAveragePercent.
  ///
  /// In uz, this message translates to:
  /// **'O\'rtacha davomat'**
  String get attendanceAveragePercent;

  /// No description provided for @attendanceRecordsCount.
  ///
  /// In uz, this message translates to:
  /// **'ta yozuv'**
  String get attendanceRecordsCount;

  /// No description provided for @attendanceRemaining.
  ///
  /// In uz, this message translates to:
  /// **'kutilmoqda'**
  String get attendanceRemaining;

  /// No description provided for @attendanceMarkedCount.
  ///
  /// In uz, this message translates to:
  /// **'qatnashdi'**
  String get attendanceMarkedCount;

  /// No description provided for @attendanceEditedBadge.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlangan'**
  String get attendanceEditedBadge;

  /// No description provided for @attendancePendingLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get attendancePendingLabel;

  /// No description provided for @attendanceScheduledLabel.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan'**
  String get attendanceScheduledLabel;

  /// No description provided for @attendanceMarkedLabel.
  ///
  /// In uz, this message translates to:
  /// **'Belgilangan'**
  String get attendanceMarkedLabel;

  /// No description provided for @attendanceCenterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davomat markazi'**
  String get attendanceCenterTitle;

  /// No description provided for @attendancePrevDay.
  ///
  /// In uz, this message translates to:
  /// **'Oldingi kun'**
  String get attendancePrevDay;

  /// No description provided for @attendanceNextDay.
  ///
  /// In uz, this message translates to:
  /// **'Keyingi kun'**
  String get attendanceNextDay;

  /// No description provided for @attendanceFutureDateWarning.
  ///
  /// In uz, this message translates to:
  /// **'Kelajakdagi sana — davomat belgilab bo\'lmaydi'**
  String get attendanceFutureDateWarning;

  /// No description provided for @attendanceSummaryMarked.
  ///
  /// In uz, this message translates to:
  /// **'Belgilangani'**
  String get attendanceSummaryMarked;

  /// No description provided for @attendanceLessonDefault.
  ///
  /// In uz, this message translates to:
  /// **'Dars'**
  String get attendanceLessonDefault;

  /// No description provided for @attendanceSelectFilter.
  ///
  /// In uz, this message translates to:
  /// **'Filtrlash'**
  String get attendanceSelectFilter;

  /// No description provided for @attendanceFilterAllActions.
  ///
  /// In uz, this message translates to:
  /// **'Barcha amallar'**
  String get attendanceFilterAllActions;

  /// No description provided for @attendanceFilterActionType.
  ///
  /// In uz, this message translates to:
  /// **'Amal turi'**
  String get attendanceFilterActionType;

  /// No description provided for @attendanceMarkAllPresent.
  ///
  /// In uz, this message translates to:
  /// **'Hammasi keldi'**
  String get attendanceMarkAllPresent;

  /// No description provided for @attendanceAllLessonMarked.
  ///
  /// In uz, this message translates to:
  /// **'Barcha o\'quvchilar belgilandi'**
  String get attendanceAllLessonMarked;

  /// No description provided for @attendanceNoStudentsInGroup.
  ///
  /// In uz, this message translates to:
  /// **'Guruhda o\'quvchilar yo\'q'**
  String get attendanceNoStudentsInGroup;

  /// No description provided for @attendanceLessonNotStarted.
  ///
  /// In uz, this message translates to:
  /// **'Dars hali boshlanmagan'**
  String get attendanceLessonNotStarted;

  /// No description provided for @attendanceLessonNotStartedDetail.
  ///
  /// In uz, this message translates to:
  /// **'Dars vaqti yetganda davomat belgilash mumkin bo\'ladi'**
  String get attendanceLessonNotStartedDetail;

  /// No description provided for @financeTotalIncome.
  ///
  /// In uz, this message translates to:
  /// **'Jami kirim'**
  String get financeTotalIncome;

  /// No description provided for @financeTotalExpense.
  ///
  /// In uz, this message translates to:
  /// **'Jami chiqim'**
  String get financeTotalExpense;

  /// No description provided for @financeThisMonth.
  ///
  /// In uz, this message translates to:
  /// **'Bu oy'**
  String get financeThisMonth;

  /// No description provided for @financeLast6Months.
  ///
  /// In uz, this message translates to:
  /// **'Oxirgi 6 oy'**
  String get financeLast6Months;

  /// No description provided for @financeCurrentBalance.
  ///
  /// In uz, this message translates to:
  /// **'Joriy balans'**
  String get financeCurrentBalance;

  /// No description provided for @financeProfit.
  ///
  /// In uz, this message translates to:
  /// **'Foyda (kirim > chiqim)'**
  String get financeProfit;

  /// No description provided for @financeLoss.
  ///
  /// In uz, this message translates to:
  /// **'Zarar (chiqim > kirim)'**
  String get financeLoss;

  /// No description provided for @financeExpense.
  ///
  /// In uz, this message translates to:
  /// **'Chiqim'**
  String get financeExpense;

  /// No description provided for @financeIncome.
  ///
  /// In uz, this message translates to:
  /// **'Kirim'**
  String get financeIncome;

  /// No description provided for @monthJan.
  ///
  /// In uz, this message translates to:
  /// **'Yan'**
  String get monthJan;

  /// No description provided for @monthFeb.
  ///
  /// In uz, this message translates to:
  /// **'Fev'**
  String get monthFeb;

  /// No description provided for @monthMar.
  ///
  /// In uz, this message translates to:
  /// **'Mar'**
  String get monthMar;

  /// No description provided for @monthApr.
  ///
  /// In uz, this message translates to:
  /// **'Apr'**
  String get monthApr;

  /// No description provided for @monthMay.
  ///
  /// In uz, this message translates to:
  /// **'May'**
  String get monthMay;

  /// No description provided for @monthJun.
  ///
  /// In uz, this message translates to:
  /// **'Iyn'**
  String get monthJun;

  /// No description provided for @monthJul.
  ///
  /// In uz, this message translates to:
  /// **'Iyl'**
  String get monthJul;

  /// No description provided for @monthAug.
  ///
  /// In uz, this message translates to:
  /// **'Avg'**
  String get monthAug;

  /// No description provided for @monthSep.
  ///
  /// In uz, this message translates to:
  /// **'Sen'**
  String get monthSep;

  /// No description provided for @monthOct.
  ///
  /// In uz, this message translates to:
  /// **'Okt'**
  String get monthOct;

  /// No description provided for @monthNov.
  ///
  /// In uz, this message translates to:
  /// **'Noy'**
  String get monthNov;

  /// No description provided for @monthDec.
  ///
  /// In uz, this message translates to:
  /// **'Dek'**
  String get monthDec;

  /// No description provided for @paymentStatusCompleted.
  ///
  /// In uz, this message translates to:
  /// **'Tugallangan'**
  String get paymentStatusCompleted;

  /// No description provided for @paymentStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Xato'**
  String get paymentStatusFailed;

  /// No description provided for @paymentStatusRefunded.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarilgan'**
  String get paymentStatusRefunded;

  /// No description provided for @paymentStatusCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilingan'**
  String get paymentStatusCancelled;

  /// No description provided for @paymentSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Kvitansiya, talaba yoki guruh bo\'yicha...'**
  String get paymentSearchHint;

  /// No description provided for @paymentFilterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get paymentFilterAll;

  /// No description provided for @paymentFilterCash.
  ///
  /// In uz, this message translates to:
  /// **'Naqd'**
  String get paymentFilterCash;

  /// No description provided for @paymentFilterCard.
  ///
  /// In uz, this message translates to:
  /// **'Karta'**
  String get paymentFilterCard;

  /// No description provided for @paymentFilterTransfer.
  ///
  /// In uz, this message translates to:
  /// **'O\'tkazma'**
  String get paymentFilterTransfer;

  /// No description provided for @paymentTotalCollected.
  ///
  /// In uz, this message translates to:
  /// **'Jami yig\'ilgan'**
  String get paymentTotalCollected;

  /// No description provided for @paymentMonthly.
  ///
  /// In uz, this message translates to:
  /// **'Oylik'**
  String get paymentMonthly;

  /// No description provided for @debtNoOverdue.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan qarzlar yo\'q'**
  String get debtNoOverdue;

  /// No description provided for @expenseNoData.
  ///
  /// In uz, this message translates to:
  /// **'Xarajatlar yo\'q'**
  String get expenseNoData;

  /// No description provided for @expenseAddSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Xarajat qo\'shildi ✓'**
  String get expenseAddSuccess;

  /// No description provided for @paymentAddSuccess.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov qabul qilindi ✓'**
  String get paymentAddSuccess;

  /// No description provided for @teacherEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hali o\'qituvchilar yo\'q'**
  String get teacherEmptyTitle;

  /// No description provided for @teacherEmptyDesc.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi o\'qituvchini ro\'yxatga oling.'**
  String get teacherEmptyDesc;

  /// No description provided for @teacherSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Ism, ID yoki mutaxassislik bo\'yicha...'**
  String get teacherSearchHint;

  /// No description provided for @teacherSpecializationUndefined.
  ///
  /// In uz, this message translates to:
  /// **'Mutaxassislik belgilanmagan'**
  String get teacherSpecializationUndefined;

  /// No description provided for @groupNoStudents.
  ///
  /// In uz, this message translates to:
  /// **'Guruhda o\'quvchilar yo\'q'**
  String get groupNoStudents;

  /// No description provided for @groupNoLessons.
  ///
  /// In uz, this message translates to:
  /// **'Bu guruhda darslar yo\'q'**
  String get groupNoLessons;

  /// No description provided for @groupAvailableSlots.
  ///
  /// In uz, this message translates to:
  /// **'ta o\'rin'**
  String get groupAvailableSlots;

  /// No description provided for @groupCapacityFull.
  ///
  /// In uz, this message translates to:
  /// **'Guruh to\'lgan'**
  String get groupCapacityFull;

  /// No description provided for @groupAddStudentTitle.
  ///
  /// In uz, this message translates to:
  /// **'Guruhga o\'quvchi qo\'shish'**
  String get groupAddStudentTitle;

  /// No description provided for @groupNoUnassigned.
  ///
  /// In uz, this message translates to:
  /// **'Barcha o\'quvchilar guruhlarga tayinlangan'**
  String get groupNoUnassigned;

  /// No description provided for @groupRegisterFirst.
  ///
  /// In uz, this message translates to:
  /// **'Avval o\'quvchini ro\'yxatga oling, so\'ng guruhga qo\'shing.'**
  String get groupRegisterFirst;

  /// No description provided for @groupSelectUnassigned.
  ///
  /// In uz, this message translates to:
  /// **'Guruhga tayinlanmagan o\'quvchini tanlang'**
  String get groupSelectUnassigned;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
