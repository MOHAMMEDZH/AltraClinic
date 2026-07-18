import { userManagementMessagesAr, userManagementMessagesEn } from './user-management-messages';
import { notificationsMessagesAr, notificationsMessagesEn } from './notifications-messages';
import { analyticsMessagesAr, analyticsMessagesEn } from './analytics-messages';
import { dashboardMessagesAr, dashboardMessagesEn } from './dashboard-messages';
import { patientsMessagesAr, patientsMessagesEn } from './patients-messages';
import { schedulingMessagesAr, schedulingMessagesEn } from './scheduling-messages';
import { queueMessagesAr, queueMessagesEn } from './queue-messages';
import { emrMessagesAr, emrMessagesEn } from './emr-messages';
import { dentalMessagesAr, dentalMessagesEn } from './dental-messages';
import { beautyMessagesAr, beautyMessagesEn } from './beauty-messages';
import { inventoryMessagesAr, inventoryMessagesEn } from './inventory-messages';
import { billingMessagesAr, billingMessagesEn } from './billing-messages';
import { reportsMessagesAr, reportsMessagesEn } from './reports-messages';
import { workflowMessagesAr, workflowMessagesEn } from './workflow-messages';
import { aiMessagesAr, aiMessagesEn } from './ai-messages';
import { subscriptionMessagesAr, subscriptionMessagesEn } from './subscription-messages';
import { settingsMessagesAr, settingsMessagesEn } from './settings-messages';

export const messages = {

  'ar-SY': {

    app: {

      name: 'نظام الحجز',

      tagline: 'لوحة تحكم العيادة',

    },

    nav: {

      dashboard: 'لوحة التحكم',

      appointments: 'المواعيد',

      myAppointments: 'مواعيدي',

      queue: 'طابور الانتظار',

      patients: 'المرضى',

      encounters: 'السجلات الطبية',

      dental: 'طب الأسنان',

      beauty: 'التجميل',

      billing: 'الفواتير',

      inventory: 'المخزون',

      reports: 'التقارير',

      analytics: 'التحليلات',

      workflows: 'سير العمل',

      aiAssistant: 'المساعد الذكي',

      subscription: 'الاشتراكات',

      settings: 'الإعدادات',

    },

    auth: {

      login: 'تسجيل الدخول',

      loginSubtitle: 'وصول آمن للعيادات الطبية والأسنان والتجميل ومراكز تعدد التخصصات.',

      email: 'البريد الإلكتروني',

      password: 'كلمة المرور',

      currentPassword: 'كلمة المرور الحالية',

      newPassword: 'كلمة المرور الجديدة',

      confirmPassword: 'تأكيد كلمة المرور',

      tenantId: 'معرف المؤسسة',

      tenantHint: 'يُوفّر من مسؤول العيادة. يُحفظ على هذا الجهاز.',

      submit: 'دخول',

      loggingIn: 'جاري الدخول…',

      logout: 'تسجيل الخروج',

      error: 'فشل تسجيل الدخول. تحقق من البيانات.',

      networkError: 'تعذّر الاتصال. تحقق من الشبكة وحاول مجدداً.',

      offline: 'أنت غير متصل. تحقق من الاتصال وحاول مجدداً.',

      loading: 'جاري التحميل…',

      sessionExpired: 'انتهت الجلسة. سجّل الدخول مجدداً.',

      forgotLink: 'نسيت كلمة المرور؟',

      forgotTitle: 'استعادة كلمة المرور',

      forgotSubtitle: 'سنرسل رابط إعادة التعيين إذا كان البريد مسجلاً.',

      forgotHint: 'لأسباب أمنية، لا نؤكد وجود البريد في النظام.',

      forgotSubmit: 'إرسال رابط الاستعادة',

      forgotSuccessTitle: 'تحقق من بريدك',

      forgotSuccessBody: 'إذا كان البريد مسجلاً، ستصلك رسالة خلال دقائق.',

      forgotError: 'تعذّر إرسال رابط الاستعادة.',

      resetTitle: 'تعيين كلمة مرور جديدة',

      resetSubtitle: 'اختر كلمة مرور قوية تحمي بيانات المرضى.',

      resetSubmit: 'حفظ كلمة المرور',

      resetError: 'تعذّر إعادة تعيين كلمة المرور.',

      resetMissingToken: 'رابط غير صالح. اطلب رابطاً جديداً.',

      resetSuccessTitle: 'تم تحديث كلمة المرور',

      resetSuccessBody: 'يمكنك تسجيل الدخول بكلمة المرور الجديدة.',

      backToLogin: 'العودة لتسجيل الدخول',

      passwordPolicy: 'كلمة المرور لا تستوفي متطلبات الأمان.',

      passwordMismatch: 'كلمتا المرور غير متطابقتين.',

      passwordSameAsCurrent: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.',

      showPassword: 'إظهار كلمة المرور',

      hidePassword: 'إخفاء كلمة المرور',

      brandHeadline: 'منصة موثوقة لإدارة العيادات',

      brandCopy: 'تسجيل دخول آمن، جلسات مُدارة، وامتثال للمعايير الطبية — مصمم للفرق السريرية.',

      trustSecure: 'تشفير و جلسات محمية',

      trustCompliant: 'جاهز للامتثال والخصوصية',

      trustMultiTenant: 'عزل كامل بين المؤسسات',

      footerCompliance: 'محمي بمعايير أمان المؤسسات · WCAG AA',

      strengthWeak: 'ضعيفة',

      strengthFair: 'مقبولة',

      strengthGood: 'جيدة',

      strengthStrong: 'قوية',

      rule: {

        minLength: '8 أحرف على الأقل',

        uppercase: 'حرف كبير واحد',

        lowercase: 'حرف صغير واحد',

        digit: 'رقم واحد',

        special: 'رمز خاص واحد',

      },

      mfaTitle: 'التحقق بخطوتين',

      mfaSubtitle: 'أدخل الرمز من تطبيق المصادقة.',

      mfaCodeLabel: 'رمز التحقق',

      mfaDigit: 'رقم',

      mfaTrustDevice: 'الوثوق بهذا الجهاز لمدة 30 يوماً',

      mfaVerify: 'تحقق',
      mfaVerifying: 'جاري التحقق…',
      mfaVerifyError: 'تعذّر التحقق من الرمز.',
      mfaIncomplete: 'أدخل الرمز المكوّن من 6 أرقام.',
      mfaBackupLabel: 'رمز النسخ الاحتياطي',
      mfaBackupHint: 'أدخل أحد رموز النسخ الاحتياطي (مثل ABCD-EFGH).',
      mfaBackupIncomplete: 'أدخل رمز نسخ احتياطي صالح.',
      mfaUseBackupCode: 'استخدام رمز نسخ احتياطي',
      mfaUseAuthenticator: 'استخدام تطبيق المصادقة',
      verifyTitle: 'تأكيد البريد الإلكتروني',
      verifySubtitle: 'نفعّل عنوان بريدك للوصول الآمن.',
      verifyLoading: 'جاري التحقق من بريدك…',
      verifyRetry: 'إعادة المحاولة',
      verifyError: 'تعذّر تأكيد البريد الإلكتروني.',
      verifyMissingToken: 'رابط غير صالح. اطلب رسالة تحقق جديدة.',
      verifySuccessTitle: 'تم تأكيد البريد',
      verifySuccessBody: 'يمكنك تسجيل الدخول الآن.',
      errors: {
        invalidCredentials: 'البريد أو كلمة المرور غير صحيحة.',
        invalidMfaCode: 'رمز التحقق غير صحيح.',
        accountInactive: 'تم تعطيل حسابك. تواصل مع المسؤول.',
        emailNotVerified: 'يرجى تأكيد بريدك قبل تسجيل الدخول.',
        accountLocked: 'الحساب مقفل مؤقتاً. حاول بعد {minutes} دقيقة تقريباً.',
        rateLimited: 'محاولات كثيرة. أعد المحاولة بعد {seconds} ثانية.',
        resetTokenInvalid: 'رابط إعادة التعيين غير صالح.',
        resetTokenExpired: 'انتهت صلاحية رابط إعادة التعيين.',
        mfaChallengeExpired: 'انتهت صلاحية خطوة التحقق. سجّل الدخول مجدداً.',
      },

    },

    security: {

      title: 'أمان الحساب',

      subtitle: 'إدارة كلمة المرور، الجلسات، الأجهزة، والمصادقة الثنائية.',

      nav: {

        overview: 'نظرة عامة',

        password: 'كلمة المرور',

        sessions: 'الجلسات',

        devices: 'الأجهزة',

        mfa: 'المصادقة الثنائية',

        profile: 'الملف الأمني',

      },

      overviewTitle: 'مركز الأمان',

      overviewDesc: 'راجع إعدادات الأمان وحدّثها بانتظام لحماية بيانات المرضى.',

      manage: 'إدارة',

      cards: {

        password: {

          title: 'كلمة المرور',

          desc: 'غيّر كلمة المرور وتحقق من قوتها.',

        },

        sessions: {

          title: 'الجلسات النشطة',

          desc: 'راجع الجلسات وسجّل الخروج من الأجهزة الأخرى.',

        },

        devices: {

          title: 'الأجهزة',

          desc: 'عرض الأجهزة المتصلة بحسابك.',

        },

        mfa: {

          title: 'المصادقة الثنائية',

          desc: 'طبقة حماية إضافية لتسجيل الدخول.',

        },

        profile: {

          title: 'الملف الأمني',

          desc: 'تأكيد البريد ومعرفات الحساب.',

        },

      },

      changePasswordTitle: 'تغيير كلمة المرور',

      changePasswordDesc: 'سيُنهى تسجيل الدخول على الأجهزة الأخرى بعد التغيير.',

      changePasswordSubmit: 'تحديث كلمة المرور',

      passwordChangedTitle: 'تم التحديث',

      passwordChanged: 'تم تغيير كلمة المرور بنجاح.',

      passwordChangedWithSessions: 'تم التغيير. أُنهيت {count} جلسة أخرى.',

      passwordChangeError: 'تعذّر تغيير كلمة المرور.',

      sessionsTitle: 'إدارة الجلسات',

      sessionsDesc: 'كل جلسة تمثل تسجيل دخول نشطاً على جهاز.',

      sessionsEmpty: 'لا توجد جلسات نشطة.',

      sessionsLoadError: 'تعذّر تحميل الجلسات.',

      sessionsRevokeError: 'تعذّر إنهاء الجلسات.',

      sessionsRevoked: 'أُنهيت {count} جلسة.',

      revokeOthers: 'إنهاء الجلسات الأخرى',
      revokeSession: 'إنهاء الجلسة',
      sessionRevoked: 'أُنهيت الجلسة.',

      refresh: 'تحديث',

      currentSession: 'الجلسة الحالية',

      sessionStarted: 'بدأت',

      sessionExpires: 'تنتهي',

      unknownDevice: 'جهاز غير معروف',

      unknownIp: 'IP غير معروف',

      devicesTitle: 'إدارة الأجهزة',

      devicesDesc: 'الأجهزة التي سجّلت الدخول إلى حسابك.',

      devicesEmpty: 'لا توجد أجهزة مسجلة.',

      devicesLoadError: 'تعذّر تحميل الأجهزة.',

      deviceSessionCount: '{count} جلسة نشطة',

      thisDevice: 'هذا الجهاز',

      profileTitle: 'إعدادات الملف الأمني',

      profileDesc: 'معلومات الحساب وإعدادات التحقق.',

      userId: 'معرف المستخدم',

      tenantId: 'معرف المؤسسة',

      roles: 'الأدوار',

      resendVerification: 'إعادة إرسال بريد التحقق',

      verificationSent: 'تم إرسال بريد التحقق.',

      verificationError: 'تعذّر إرسال بريد التحقق.',

      mfaTitle: 'المصادقة الثنائية',

      mfaDesc: 'فعّل TOTP لتأمين الوصول إلى النظام.',

      mfaStatusEnabled: 'المصادقة الثنائية مفعّلة على حسابك.',

      mfaStatusPending: 'أكمل الإعداد بإدخال رمز من تطبيق المصادقة.',

      mfaStatusDisabled: 'المصادقة الثنائية غير مفعّلة.',

      mfaBeginSetup: 'إعداد تطبيق المصادقة',

      mfaScanInstructions: 'أضف المفتاح إلى تطبيق المصادقة، ثم أدخل الرمز المكوّن من 6 أرقام.',

      mfaSecretLabel: 'مفتاح الإعداد',

      mfaOpenAuthenticator: 'فتح في تطبيق المصادقة',

      mfaConfirmSetup: 'تفعيل المصادقة الثنائية',

      mfaCancelSetup: 'إلغاء',

      mfaDisable: 'تعطيل المصادقة الثنائية',

      mfaDisableInstructions: 'أدخل كلمة المرور ورمز المصادقة الحالي لتعطيل MFA.',

      mfaEnabledSuccess: 'تم تفعيل المصادقة الثنائية.',

      mfaDisabledSuccess: 'تم تعطيل المصادقة الثنائية.',

      mfaSetupError: 'تعذّر بدء إعداد MFA.',

      mfaConfirmError: 'تعذّر تأكيد إعداد MFA.',

      mfaDisableError: 'تعذّر تعطيل MFA.',
      mfaBackupCodesTitle: 'رموز النسخ الاحتياطي',
      mfaBackupCodesDesc: 'احفظ هذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة.',
      mfaBackupCodesWarning: 'لن تُعرض هذه الرموز مرة أخرى.',
      mfaBackupCodesRemaining: 'رموز احتياطية متبقية: {count}',
      mfaRegenerateBackupCodes: 'إنشاء رموز جديدة',
      mfaRegenerateBackupSuccess: 'تم إنشاء رموز نسخ احتياطي جديدة.',
      mfaRegenerateBackupError: 'تعذّر إنشاء الرموز الاحتياطية.',

      email: 'البريد الإلكتروني',

      emailVerified: 'مؤكّد',

      emailUnverified: 'غير مؤكّد',

    },

    shell: {

      search: 'بحث…',

      searchShortcut: 'Ctrl+K',

      notifications: 'الإشعارات',

      language: 'اللغة',
      switchToArabic: 'العربية',
      switchToEnglish: 'English',

      theme: 'المظهر',

      themeLight: 'فاتح',

      themeDark: 'داكن',

      themeSystem: 'النظام',

      menu: 'القائمة',

      collapse: 'طي القائمة',

      skipToContent: 'تخطي إلى المحتوى',

      userMenu: 'قائمة المستخدم',

      security: 'الأمان',

    },

    ...dashboardMessagesAr,
    ...analyticsMessagesAr,
    ...userManagementMessagesAr,
    ...notificationsMessagesAr,
    ...workflowMessagesAr,
    ...aiMessagesAr,
    ...subscriptionMessagesAr,
    ...settingsMessagesAr,
    patients: patientsMessagesAr,
    scheduling: schedulingMessagesAr,
    queue: queueMessagesAr,
    emr: emrMessagesAr,
    dental: dentalMessagesAr,
    beauty: beautyMessagesAr,
    inventory: inventoryMessagesAr,
    billing: billingMessagesAr,
    reports: reportsMessagesAr,

    pages: {

      dashboardTitle: 'لوحة التحكم',

      dashboardHint: 'ودجات حسب الدور مع مؤشرات مباشرة وإجراءات سريعة.',

      placeholder: 'هذه الصفحة قيد التطوير — الهيكل الأساسي جاهز.',

      reports: {
        title: 'التقارير',
        subtitle: 'تقارير تشغيلية حسب الصلاحيات المتاحة لدورك.',
        inventoryCardTitle: 'تقارير المخزون',
        inventoryCardDesc: 'تقييم المخزون، الاستهلاك، المشتريات، وحركات الصرف.',
        analyticsCardTitle: 'تحليلات العيادة',
        analyticsCardDesc: 'اتجاهات الإيراد والمواعيد ونمو المرضى والصحة التشغيلية.',
        openAnalytics: 'فتح التحليلات',
        openReport: 'فتح التقرير',
        empty: 'لا توجد تقارير متاحة لدورك حالياً.',
      },

    },

  },

  'en-US': {

    app: {

      name: 'Booking System',

      tagline: 'Clinic Dashboard',

    },

    nav: {

      dashboard: 'Dashboard',

      appointments: 'Appointments',

      myAppointments: 'My appointments',

      queue: 'Queue',

      patients: 'Patients',

      encounters: 'Encounters',

      dental: 'Dental',

      beauty: 'Beauty',

      billing: 'Billing',

      inventory: 'Inventory',

      reports: 'Reports',

      analytics: 'Analytics',

      workflows: 'Workflows',

      aiAssistant: 'AI Assistant',

      subscription: 'Subscription',

      settings: 'Settings',

    },

    auth: {

      login: 'Sign in',

      loginSubtitle: 'Secure access for medical, dental, beauty, and multi-specialty clinics.',

      email: 'Email',

      password: 'Password',

      currentPassword: 'Current password',

      newPassword: 'New password',

      confirmPassword: 'Confirm password',

      tenantId: 'Organization ID',

      tenantHint: 'Provided by your clinic admin. Saved on this device.',

      submit: 'Sign in',

      loggingIn: 'Signing in…',

      logout: 'Sign out',

      error: 'Sign in failed. Check your credentials.',

      networkError: 'Connection failed. Check your network and try again.',

      offline: 'You are offline. Check your connection and try again.',

      loading: 'Loading…',

      sessionExpired: 'Session expired. Please sign in again.',

      forgotLink: 'Forgot password?',

      forgotTitle: 'Reset password',

      forgotSubtitle: 'We will email a reset link if the address is registered.',

      forgotHint: 'For security, we do not confirm whether an email exists.',

      forgotSubmit: 'Send reset link',

      forgotSuccessTitle: 'Check your inbox',

      forgotSuccessBody: 'If registered, you will receive an email within a few minutes.',

      forgotError: 'Could not send reset link.',

      resetTitle: 'Set a new password',

      resetSubtitle: 'Choose a strong password to protect patient data.',

      resetSubmit: 'Save password',

      resetError: 'Could not reset password.',

      resetMissingToken: 'Invalid link. Request a new reset email.',

      resetSuccessTitle: 'Password updated',

      resetSuccessBody: 'You can sign in with your new password.',

      backToLogin: 'Back to sign in',

      passwordPolicy: 'Password does not meet security requirements.',

      passwordMismatch: 'Passwords do not match.',

      passwordSameAsCurrent: 'New password must differ from your current password.',

      showPassword: 'Show password',

      hidePassword: 'Hide password',

      brandHeadline: 'Trusted clinic operations platform',

      brandCopy: 'Secure sign-in, managed sessions, and healthcare-grade compliance — built for clinical teams.',

      trustSecure: 'Encrypted sessions & tokens',

      trustCompliant: 'Privacy-ready workflows',

      trustMultiTenant: 'Strict tenant isolation',

      footerCompliance: 'Enterprise security · WCAG AA',

      strengthWeak: 'Weak',

      strengthFair: 'Fair',

      strengthGood: 'Good',

      strengthStrong: 'Strong',

      rule: {

        minLength: 'At least 8 characters',

        uppercase: 'One uppercase letter',

        lowercase: 'One lowercase letter',

        digit: 'One number',

        special: 'One special character',

      },

      mfaTitle: 'Two-factor verification',

      mfaSubtitle: 'Enter the code from your authenticator app.',

      mfaCodeLabel: 'Verification code',

      mfaDigit: 'Digit',

      mfaTrustDevice: 'Trust this device for 30 days',

      mfaVerify: 'Verify',
      mfaVerifying: 'Verifying…',
      mfaVerifyError: 'Could not verify the code.',
      mfaIncomplete: 'Enter the 6-digit code.',
      mfaBackupLabel: 'Backup code',
      mfaBackupHint: 'Enter one of your backup codes (e.g. ABCD-EFGH).',
      mfaBackupIncomplete: 'Enter a valid backup code.',
      mfaUseBackupCode: 'Use a backup code instead',
      mfaUseAuthenticator: 'Use authenticator app instead',
      verifyTitle: 'Verify your email',
      verifySubtitle: 'We are confirming your email address for secure access.',
      verifyLoading: 'Verifying your email…',
      verifyRetry: 'Try again',
      verifyError: 'Could not verify your email.',
      verifyMissingToken: 'Invalid link. Request a new verification email.',
      verifySuccessTitle: 'Email verified',
      verifySuccessBody: 'You can sign in now.',
      errors: {
        invalidCredentials: 'Invalid email or password.',
        invalidMfaCode: 'Invalid verification code.',
        accountInactive: 'Your account has been deactivated. Contact your administrator.',
        emailNotVerified: 'Please verify your email address before logging in.',
        accountLocked: 'Account is temporarily locked. Try again in about {minutes} minute(s).',
        rateLimited: 'Too many attempts. Please retry after {seconds} seconds.',
        resetTokenInvalid: 'Reset link is invalid or has been revoked.',
        resetTokenExpired: 'Reset link has expired.',
        mfaChallengeExpired: 'Verification step expired. Please sign in again.',
      },

    },

    security: {

      title: 'Account security',

      subtitle: 'Manage password, sessions, devices, and two-factor authentication.',

      nav: {

        overview: 'Overview',

        password: 'Password',

        sessions: 'Sessions',

        devices: 'Devices',

        mfa: 'Two-factor',

        profile: 'Security profile',

      },

      overviewTitle: 'Security center',

      overviewDesc: 'Review and update security settings regularly to protect patient data.',

      manage: 'Manage',

      cards: {

        password: {

          title: 'Password',

          desc: 'Change your password and verify its strength.',

        },

        sessions: {

          title: 'Active sessions',

          desc: 'Review sessions and sign out other devices.',

        },

        devices: {

          title: 'Devices',

          desc: 'See devices connected to your account.',

        },

        mfa: {

          title: 'Two-factor auth',

          desc: 'Add an extra layer of sign-in protection.',

        },

        profile: {

          title: 'Security profile',

          desc: 'Email verification and account identifiers.',

        },

      },

      changePasswordTitle: 'Change password',

      changePasswordDesc: 'Other devices will be signed out after a successful change.',

      changePasswordSubmit: 'Update password',

      passwordChangedTitle: 'Updated',

      passwordChanged: 'Your password was changed successfully.',

      passwordChangedWithSessions: 'Password changed. Ended {count} other session(s).',

      passwordChangeError: 'Could not change password.',

      sessionsTitle: 'Session management',

      sessionsDesc: 'Each session represents an active sign-in on a device.',

      sessionsEmpty: 'No active sessions.',

      sessionsLoadError: 'Could not load sessions.',

      sessionsRevokeError: 'Could not revoke sessions.',

      sessionsRevoked: 'Revoked {count} session(s).',

      revokeOthers: 'Sign out other sessions',
      revokeSession: 'Sign out session',
      sessionRevoked: 'Session ended.',

      refresh: 'Refresh',

      currentSession: 'Current session',

      sessionStarted: 'Started',

      sessionExpires: 'Expires',

      unknownDevice: 'Unknown device',

      unknownIp: 'Unknown IP',

      devicesTitle: 'Device management',

      devicesDesc: 'Devices that have signed in to your account.',

      devicesEmpty: 'No registered devices.',

      devicesLoadError: 'Could not load devices.',

      deviceSessionCount: '{count} active session(s)',

      thisDevice: 'This device',

      profileTitle: 'Profile security settings',

      profileDesc: 'Account identifiers and verification options.',

      userId: 'User ID',

      tenantId: 'Organization ID',

      roles: 'Roles',

      resendVerification: 'Resend verification email',

      verificationSent: 'Verification email sent.',

      verificationError: 'Could not send verification email.',

      mfaTitle: 'Two-factor authentication',

      mfaDesc: 'Enable TOTP for stronger account protection.',

      mfaStatusEnabled: 'Two-factor authentication is enabled on your account.',

      mfaStatusPending: 'Finish setup by entering a code from your authenticator app.',

      mfaStatusDisabled: 'Two-factor authentication is not enabled.',

      mfaBeginSetup: 'Set up authenticator',

      mfaScanInstructions: 'Add this secret to your authenticator app, then enter the 6-digit code.',

      mfaSecretLabel: 'Setup key',

      mfaOpenAuthenticator: 'Open in authenticator app',

      mfaConfirmSetup: 'Enable two-factor',

      mfaCancelSetup: 'Cancel',

      mfaDisable: 'Disable two-factor',

      mfaDisableInstructions: 'Enter your password and a current authenticator code to disable MFA.',

      mfaEnabledSuccess: 'Two-factor authentication is now enabled.',

      mfaDisabledSuccess: 'Two-factor authentication has been disabled.',

      mfaSetupError: 'Could not start MFA setup.',

      mfaConfirmError: 'Could not confirm MFA setup.',

      mfaDisableError: 'Could not disable MFA.',
      mfaBackupCodesTitle: 'Backup codes',
      mfaBackupCodesDesc: 'Store these codes in a safe place. Each code works once.',
      mfaBackupCodesWarning: 'These codes will not be shown again.',
      mfaBackupCodesRemaining: 'Backup codes remaining: {count}',
      mfaRegenerateBackupCodes: 'Generate new codes',
      mfaRegenerateBackupSuccess: 'New backup codes were generated.',
      mfaRegenerateBackupError: 'Could not regenerate backup codes.',

      email: 'Email',

      emailVerified: 'Verified',

      emailUnverified: 'Not verified',

    },

    shell: {

      search: 'Search…',

      searchShortcut: 'Ctrl+K',

      notifications: 'Notifications',

      language: 'Language',
      switchToArabic: 'العربية',
      switchToEnglish: 'English',

      theme: 'Theme',

      themeLight: 'Light',

      themeDark: 'Dark',

      themeSystem: 'System',

      menu: 'Menu',

      collapse: 'Collapse sidebar',

      skipToContent: 'Skip to content',

      userMenu: 'User menu',

      security: 'Security',

    },

    ...dashboardMessagesEn,
    ...analyticsMessagesEn,
    ...userManagementMessagesEn,
    ...notificationsMessagesEn,
    ...workflowMessagesEn,
    ...aiMessagesEn,
    ...subscriptionMessagesEn,
    ...settingsMessagesEn,
    patients: patientsMessagesEn,
    scheduling: schedulingMessagesEn,
    queue: queueMessagesEn,
    emr: emrMessagesEn,
    dental: dentalMessagesEn,
    beauty: beautyMessagesEn,
    inventory: inventoryMessagesEn,
    billing: billingMessagesEn,
    reports: reportsMessagesEn,

    pages: {

      dashboardTitle: 'Dashboard',

      dashboardHint: 'Role-based widgets with live clinic KPIs and quick actions.',

      placeholder: 'This page is under development — shell foundation is ready.',

      reports: {
        title: 'Reports',
        subtitle: 'Operational reports available for your role.',
        inventoryCardTitle: 'Inventory reports',
        inventoryCardDesc: 'Stock valuation, consumption, procurement, and movement analytics.',
        analyticsCardTitle: 'Clinic analytics',
        analyticsCardDesc: 'Revenue, appointments, patient growth, and operational health trends.',
        openAnalytics: 'Open analytics',
        openReport: 'Open report',
        empty: 'No reports are available for your role yet.',
      },

    },

  },

} as const;



/** Replace `{key}` placeholders in translated strings. */

export function formatMessage(template: string, vars: Record<string, string | number>): string {

  return Object.entries(vars).reduce(

    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),

    template,

  );

}


