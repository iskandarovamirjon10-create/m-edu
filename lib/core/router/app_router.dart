import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../security/permissions.dart';
import '../../features/auth/presentation/providers/auth_providers.dart';
import '../../features/settings/domain/entities/app_settings.dart';
import 'access_denied_page.dart';
import 'not_found_page.dart';
import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/pin_lock_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/dashboard/presentation/pages/main_shell_page.dart';
import '../../features/dashboard/presentation/pages/more_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/settings/presentation/pages/user_management_page.dart';
import '../../features/diagnostics/presentation/pages/admin_diagnostics_page.dart';
import '../../features/identity/presentation/pages/identity_detail_page.dart';
import '../../features/students/presentation/pages/students_list_page.dart';
import '../../features/students/presentation/pages/student_detail_page.dart';
import '../../features/students/presentation/pages/student_360_page.dart';
import '../../features/teachers/presentation/pages/teachers_list_page.dart';
import '../../features/teachers/presentation/pages/teacher_profile_page.dart';
import '../../features/homework/presentation/pages/homework_page.dart';
import '../../features/homework/presentation/pages/homework_detail_page.dart';
import '../../features/homework/presentation/pages/new_homework_page.dart';
import '../../features/scheduling/presentation/pages/lesson_detail_page.dart';
import '../../features/attendance/presentation/pages/attendance_center_page.dart';
import '../../features/attendance/presentation/pages/attendance_history_page.dart';
import '../../features/identity/presentation/pages/identity_list_page.dart';
import '../../features/identity/presentation/pages/identity_scan_page.dart';
import '../../features/identity/presentation/pages/register_identity_page.dart';
import '../../features/organization/presentation/pages/first_run_wizard_page.dart';
import '../../features/groups/presentation/pages/groups_list_page.dart';
import '../../features/groups/presentation/pages/create_group_page.dart';
import '../../features/groups/presentation/pages/add_students_to_group_page.dart';
import '../../features/groups/presentation/pages/group_detail_page.dart';
import '../../features/attendance/presentation/pages/attendance_page.dart';
import '../../features/payments/presentation/pages/debts_list_page.dart';
import '../../features/payments/presentation/pages/finance_page.dart';
import '../../features/payments/presentation/pages/new_payment_page.dart';
import '../../features/payments/presentation/pages/new_expense_page.dart';
import '../../features/payments/presentation/pages/payments_list_page.dart';
import '../../features/scheduling/presentation/pages/schedule_page.dart';
import '../../features/scheduling/presentation/pages/rooms_list_page.dart';
import '../../features/reports/presentation/pages/reports_page.dart';
import '../../features/reports/presentation/pages/student_stats_page.dart';
import '../../features/reports/presentation/pages/monthly_attendance_report_page.dart';
import '../../features/reports/presentation/pages/debt_report_page.dart';
import '../../features/reports/presentation/pages/revenue_report_page.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/gamification/presentation/pages/gamification_page.dart';
import '../../features/crm/presentation/pages/crm_kanban_page.dart';
import '../../features/face_recognition/presentation/pages/face_scan_page.dart';
import '../../features/face_recognition/presentation/pages/face_enroll_page.dart';
import '../../features/grades/presentation/pages/grades_page.dart';
import '../../features/settings/presentation/pages/printer_page.dart';

/// Auth holatiga bog'liq holda yagona [GoRouter]'ni ta'minlaydi.
///
/// Router `refreshListenable` orqali [authStateNotifier]'ni tinglaydi —
/// foydalanuvchi kirgan/chiqqanda redirect qoidalari qayta baholanadi.
/// Ro'yxatdan o'tmagan foydalanuvchi himoyalangan sahifalarga kira
/// olmaydi (auth guard — product-ready talab).
final authRouterProvider = Provider<GoRouter>((ref) {
  // Auth holati o'zgarganda router qayta yaratilmaydi — `refreshListenable`
  // orqali redirect qoidalari qayta baholanadi. Bu yerda faqat bir marta
  // router yaratiladi (state yo'qotilmaydi).
  return AppRouter.create();
});

class AppRouter {
  AppRouter._();

  /// Router'ni auth holatini [authStateNotifier] orqali kuzatib yasaydi.
  ///
  /// Ommaviy sahifalar: /splash, /login, /register. Boshqa barcha
  /// marshrutlar autentifikatsiya talab qiladi — tizimga kirmagan
  /// foydalanuvchi /login ga yo'naltiriladi.
  /// Autentifikatsiya talab qilmaydigan (ommaviy) marshrutlar.
  ///
  /// Yangi ommaviy sahifa qo'shilganda shu ro'yxatga ham qo'shish
  /// esdan chiqmasligi kerak — aks holda auth guard uni bloklaydi.
  static const Set<String> _publicRoutes = {'/splash', '/login', '/register', '/pin-lock'};

  /// Himoyalangan marshrutlar uchun talab qilinadigan permission (PHASE D).
  ///
  /// ROUTE PATH (fullPath — template, masalan `/students/:identityId`) →
  /// permission. Ro'yxatda bo'lmagan marshrutlar barcha autentifikatsiyalangan
  /// foydalanuvchilarga ochiq (masalan /dashboard, /more, /notifications).
  /// Foydalanuvchi ruxsatsiz ochmoqchi bo'lsa — [AccessDeniedPage]'ga
  /// yo'naltiriladi (deep-link ham shu himoyadan o'tadi).
  ///
  /// AUDIT P2-04 (CRITICAL): Ilgari kalit ROUTE NAME edi — lekin go_router
  /// 14.x top-level redirect'da `state.name` NI DOIM NULL qaytaradi
  /// (`buildTopLevelGoRouterState` — "No name available at the top level").
  /// Bu RBAC route guard'ni butunlay O'CHIRIB qo'ygan edi: har qanday
  /// autentifikatsiyalangan foydalanuvchi istalgan himoyalangan sahifaga
  /// deep-link orqali kira olardi (spec §30 fail-closed buzilgan).
  /// Endi kalit `state.fullPath` (template path) — redirect'da mavjud.
  static const Map<String, AppPermission> _routePermissions = {
    '/setup': AppPermission.settingsEdit,
    '/students': AppPermission.studentsView,
    '/students/:identityId': AppPermission.studentsView,
    '/students/:identityId/360': AppPermission.studentsView,
    '/attendance': AppPermission.attendanceView,
    '/attendance/center': AppPermission.attendanceView,
    '/attendance/history': AppPermission.attendanceView,
    '/schedule': AppPermission.scheduleView,
    '/schedule/lesson/:scheduleId': AppPermission.scheduleView,
    '/schedule/rooms': AppPermission.scheduleView,
    '/finance': AppPermission.financeView,
    '/finance/payments': AppPermission.financeView,
    '/payments/debts': AppPermission.financeView,
    '/payments/new': AppPermission.financeCreate,
    '/finance/expense/new': AppPermission.financeCreate,
    '/settings': AppPermission.settingsView,
    '/settings/users': AppPermission.usersView,
    '/settings/diagnostics': AppPermission.settingsView,
    '/settings/printer': AppPermission.settingsView,
    '/teachers': AppPermission.teachersView,
    '/teachers/:identityId': AppPermission.teachersView,
    '/groups': AppPermission.groupsView,
    '/groups/:groupId': AppPermission.groupsView,
    '/groups/create': AppPermission.groupsCreate,
    '/groups/:groupId/edit': AppPermission.groupsEdit,
    '/groups/:groupId/add-students': AppPermission.groupsEdit,
    '/grades': AppPermission.gradesView,
    '/reports': AppPermission.reportsView,
    '/reports/students': AppPermission.reportsView,
    '/reports/debts': AppPermission.reportsView,
    '/reports/monthly': AppPermission.reportsView,
    '/reports/revenue': AppPermission.reportsView,
    '/identity': AppPermission.studentsView,
    '/identity/:identityId': AppPermission.studentsView,
    '/identity/register': AppPermission.studentsCreate,
    '/identity/scan': AppPermission.attendanceCreate,
    '/face-scan': AppPermission.faceIdUse,
    '/face-enroll/:identityId': AppPermission.faceIdUse,
    // Gamification — ball/daraja hisobi moliyaviy agregatlardan (yig'ilgan
    // summa, to'lovlar soni) tuzilgani uchun financeView talab qilinadi.
    // Aks holda staff (financeView'siz) moliyaviy ma'lumotni ko'ra olardi.
    '/gamification': AppPermission.financeView,
    '/crm': AppPermission.crmLeadsView,
    '/settings/pin': AppPermission.settingsEdit,
  };

  /// [AuthStateAuthenticated.role] string'ini [UserRole]'ga o'giradi.
  /// Noma'lum/bo'sh rol → `unknown` (FAIL CLOSED — hech qachon admin emas).
  /// AUDIT P2-03: wire format ('super_admin') ham qabul qilinadi.
  static UserRole _roleFromAuth(AuthState state) {
    if (state is AuthStateAuthenticated) {
      return UserRole.fromWire(state.role);
    }
    return UserRole.unknown;
  }

  static GoRouter create() {
    return GoRouter(
      initialLocation: '/splash',
      debugLogDiagnostics: false,
      refreshListenable: authStateNotifier,
      redirect: (context, state) {
        final authState = authStateNotifier.value;
        final authenticated = authState is AuthStateAuthenticated;

        // 1) Auth guard: kirmagan foydalanuvchi → login.
        if (!authenticated && !_publicRoutes.contains(state.matchedLocation)) {
          return '/login';
        }
        // 2) Ommaviy sahifaga kirgan autentifikatsiyalangan foydalanuvchi
        //    → dashboard'ga (login/register sahifalari auth'da yopiladi).
        if (authenticated && _publicRoutes.contains(state.matchedLocation)) {
          return '/dashboard';
        }
        // 3) RBAC guard: marshrut uchun ruxsat yetarli bo'lmasa → DENY.
        // AUDIT P2-04 (CRITICAL): `state.name` top-level redirect'da DOIM
        // null — `state.fullPath` (template path) ishlatiladi. Aks holda
        // himoya butunlay ishlamay qoladi (deep-link xavfi).
        // 
        // FIX P2-04: Use Safe navigation to handle null fullPath and improve RBAC.
        final routePath = state.fullPath;
        final required = routePath != null ? _routePermissions[routePath] : null;
        if (required != null &&
            !Permissions.can(_roleFromAuth(authState), required)) {
          // /access-denied'da turgan bo'lsak — loop qilmaymiz.
          if (state.matchedLocation == '/access-denied') return null;
          return '/access-denied';
        }
        return null;
      },
      routes: [
      // Auth
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterPage(),
      ),

      // PIN Lock
      GoRoute(
        path: '/pin-lock',
        name: 'pin-lock',
        builder: (context, state) => const PinLockPage(),
      ),

      // Ruxsat yo'q holatida yo'naltiriladigan sahifa (PHASE D).
      GoRoute(
        path: '/access-denied',
        name: 'access-denied',
        builder: (context, state) => const AccessDeniedPage(),
      ),

      // Setup
      GoRoute(
        path: '/setup',
        name: 'setup',
        builder: (context, state) => const FirstRunWizardPage(),
      ),

      // ─── Asosiy shell: pastki navigatsiya paneli (bottom bar) ───────────
      //
      // 5 ta ko'rinadigan bo'lim: Bosh sahifa, O'quvchilar, Davomat, Jadval,
      // Ko'proq. Moliya (/finance) va Sozlamalar (/settings) — yashirin
      // branch'lar: ular pastki panelda emas, "Ko'proq" sahifasidan ochiladi
      // (directive §15, §43). Yashirin bo'lsa ham branch'lar `go()` orqali
      // to'g'ri ochiladi va shell yashab qoladi (back tugmasi ishlaydi).
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShellPage(navigationShell: navigationShell),
        branches: [
          // 0: Bosh sahifa
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                name: 'dashboard',
                builder: (context, state) => const DashboardPage(),
              ),
            ],
          ),
          // 1: O'quvchilar
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/students',
                name: 'students',
                builder: (context, state) => const StudentsListPage(),
              ),
            ],
          ),
          // 2: Davomat
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/attendance',
                name: 'attendance',
                builder: (context, state) => const AttendancePage(),
              ),
            ],
          ),
          // 3: Jadval
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/schedule',
                name: 'schedule',
                builder: (context, state) => const SchedulePage(),
              ),
            ],
          ),
          // 4: Ko'proq — qolgan bo'limlar (Moliya, Hisobotlar, Sozlamalar,
          //     O'qituvchilar, Guruhlar, Xonalar, Face ID, QR, Telegram,
          //     Printer, Zaxira, ID Shaxslar, Bildirishnomalar)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/more',
                name: 'more',
                builder: (context, state) => const MorePage(),
              ),
            ],
          ),
          // 5: Moliya (yashirin branch — pastki panelda ko'rsatilmaydi)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/finance',
                name: 'finance',
                builder: (context, state) => const FinancePage(),
              ),
            ],
          ),
          // 6: Sozlamalar (yashirin branch — pastki panelda ko'rsatilmaydi)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                name: 'settings',
                builder: (context, state) => const SettingsPage(),
              ),
            ],
          ),
          // 7: Foydalanuvchilar (yashirin branch — /settings/users)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings/users',
                name: 'settings-users',
                builder: (context, state) => const UserManagementPage(),
              ),
            ],
          ),
          // 8: Guruhlar (PHASE D — desktop sidebar'da ko'rinadigan branch;
          //    mobil'da "Ko'proq" tab'iga map qilinadi).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                name: 'groups',
                builder: (context, state) => const GroupsListPage(),
              ),
            ],
          ),
          // 9: Hisobotlar (PHASE D — desktop sidebar'da ko'rinadigan branch).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                name: 'reports',
                builder: (context, state) => const ReportsPage(),
              ),
            ],
          ),
          // 10: Uy vazifalari (SCREEN 22 — sidebar'da ko'rinadigan branch;
          //     mobil'da "Ko'proq" tab'iga map qilinadi).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/homework',
                name: 'homework',
                builder: (context, state) => const HomeworkPage(),
              ),
            ],
          ),
          // 11: O'qituvchilar (SCREEN 13 — sidebar'da ko'rinadigan branch).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/teachers',
                name: 'teachers',
                builder: (context, state) => const TeachersListPage(),
              ),
            ],
          ),
        ],
      ),

      // Payments detail (shell ustida ochiladi)
      GoRoute(
        path: '/payments/debts',
        name: 'payments-debts',
        builder: (context, state) => const DebtsListPage(),
      ),

      // Finance (moliya bo'limi) – asosiy '/finance' yo'li shell branchida aniqlangan
      GoRoute(
        path: '/finance/payments',
        name: 'finance-payments',
        builder: (context, state) => const PaymentsListPage(),
      ),
      GoRoute(
        path: '/payments/new',
        name: 'payments-new',
        builder: (context, state) => const NewPaymentPage(),
      ),
      GoRoute(
        path: '/finance/expense/new',
        name: 'expense-new',
        builder: (context, state) => const NewExpensePage(),
      ),

      // Students (detail sahifasi shell ustida ochiladi)
      GoRoute(
        path: '/students/:identityId',
        name: 'student-detail',
        builder: (context, state) => StudentDetailPage(
          identityId: state.pathParameters['identityId']!,
        ),
      ),

      // Student 360 — F24 fix. Full aggregate view of student.
      GoRoute(
        path: '/students/:identityId/360',
        name: 'student-360',
        builder: (context, state) => Student360Page(
          identityId: state.pathParameters['identityId']!,
        ),
      ),

      // Teachers — profil sahifasi (SCREEN 14). Ro'yxat branch 11'da.
      GoRoute(
        path: '/teachers/:identityId',
        name: 'teacher-profile',
        builder: (context, state) => TeacherProfilePage(
          identityId: state.pathParameters['identityId']!,
        ),
      ),

      // Homework — markaz branch 10'da; detallar top-level push.
      GoRoute(
        path: '/homework/new',
        name: 'homework-new',
        builder: (context, state) => const NewHomeworkPage(),
      ),
      GoRoute(
        path: '/homework/:homeworkId',
        name: 'homework-detail',
        builder: (context, state) => HomeworkDetailPage(
          homeworkId: state.pathParameters['homeworkId']!,
        ),
      ),
      GoRoute(
        path: '/homework/:homeworkId/edit',
        name: 'homework-edit',
        builder: (context, state) => NewHomeworkPage(
          editHomeworkId: state.pathParameters['homeworkId'],
        ),
      ),

      // Groups — ro'yxat sahifasi shell branch'ida (branch 8);
      // bu yerda faqat chuqur sahifalar top-level push sifatida.
      GoRoute(
        path: '/groups/create',
        name: 'groups-create',
        builder: (context, state) => const CreateGroupPage(),
      ),
      GoRoute(
        path: '/groups/:groupId',
        name: 'groups-detail',
        builder: (context, state) => GroupDetailPage(
          groupId: state.pathParameters['groupId']!,
        ),
      ),
      GoRoute(
        path: '/groups/:groupId/edit',

        name: 'groups-edit',
        builder: (context, state) => CreateGroupPage(
          editGroupId: state.pathParameters['groupId'] ?? '',
        ),
      ),
      GoRoute(
        path: '/groups/:groupId/add-students',
        name: 'groups-add-students',
        builder: (context, state) => AddStudentsToGroupPage(
          groupId: state.pathParameters['groupId']!,
        ),
      ),

      // Face ID (Hikvision kamera)
      GoRoute(
        path: '/face-scan',
        name: 'face-scan',
        builder: (context, state) => const FaceScanPage(),
      ),
      GoRoute(
        path: '/face-enroll/:identityId',
        name: 'face-enroll',
        builder: (context, state) => FaceEnrollPage(
          identityId: state.pathParameters['identityId']!,
        ),
      ),

      // Scheduling — dars tafsiloti (SCREEN 17) va xonalar.
      GoRoute(
        path: '/schedule/lesson/:scheduleId',
        name: 'schedule-lesson-detail',
        builder: (context, state) => LessonDetailPage(
          scheduleId: state.pathParameters['scheduleId']!,
        ),
      ),
      GoRoute(
        path: '/schedule/rooms',
        name: 'schedule-rooms',
        builder: (context, state) => const RoomsListPage(),
      ),

      // Attendance — markaz (SCREEN 20) va tarix (SCREEN 21).
      GoRoute(
        path: '/attendance/center',
        name: 'attendance-center',
        builder: (context, state) => const AttendanceCenterPage(),
      ),
      GoRoute(
        path: '/attendance/history',
        name: 'attendance-history',
        builder: (context, state) => const AttendanceHistoryPage(),
      ),

      // Grades (baholar)
      GoRoute(
        path: '/grades',
        name: 'grades',
        builder: (context, state) => const GradesPage(),
      ),

      // Reports — markaz sahifasi shell branch'ida (branch 9);
      // chuqur hisobot sahifalari top-level push sifatida.
      GoRoute(
        path: '/reports/students',
        name: 'reports-students',
        builder: (context, state) => const StudentStatsPage(),
      ),
      GoRoute(
        path: '/reports/debts',
        name: 'reports-debts',
        builder: (context, state) => const DebtReportPage(),
      ),
      GoRoute(
        path: '/reports/monthly',
        name: 'reports-monthly',
        builder: (context, state) => const MonthlyAttendanceReportPage(),
      ),
      GoRoute(
        path: '/reports/revenue',
        name: 'reports-revenue',
        builder: (context, state) => const RevenueReportPage(),
      ),

      // Admin Diagnostics (ULTRA CORE §45) — troubleshooting uchun.
      // Shell ustida ochiladi; faqat settingsView ruxsati bo'lsa.
      GoRoute(
        path: '/settings/diagnostics',
        name: 'settings-diagnostics',
        builder: (context, state) => const AdminDiagnosticsPage(),
      ),

      // Thermal Printer — Bluetooth printer boshqaruvi.
      GoRoute(
        path: '/settings/printer',
        name: 'settings-printer',
        builder: (context, state) => const PrinterPage(),
      ),        // PIN Setup (settingsdan kiriladi)
      GoRoute(
        path: '/settings/pin',
        name: 'settings-pin',
        builder: (context, state) => const PinSetupPage(),
      ),

      // Notifications
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const NotificationsPage(),
      ),

      // Gamification
      GoRoute(
        path: '/gamification',
        name: 'gamification',
        builder: (context, state) => const GamificationPage(),
      ),

      // CRM — Lead Pipeline (Kanban)
      GoRoute(
        path: '/crm',
        name: 'crm',
        builder: (context, state) => const CrmKanbanPage(),
      ),

      // Identity
      GoRoute(
        path: '/identity',
        name: 'identity',
        builder: (context, state) => const IdentityListPage(),
      ),
      GoRoute(
        path: '/identity/register',
        name: 'identity-register',
        builder: (context, state) => const RegisterIdentityPage(),
      ),
      GoRoute(
        path: '/identity/scan',
        name: 'identity-scan',
        builder: (context, state) => const IdentityScanPage(),
      ),
      GoRoute(
        path: '/identity/:identityId',
        name: 'identity-detail',
        builder: (context, state) => IdentityDetailPage(
          identityId: state.pathParameters['identityId']!,
        ),
      ),
    ],
    // PHASE D: professional 404. Ichki xato tafsilotlari (exception
    // message) ko'rsatilmaydi — faqat umumiy "Sahifa topilmadi".
    errorBuilder: (context, state) => const NotFoundPage(),
    );
  }
}
