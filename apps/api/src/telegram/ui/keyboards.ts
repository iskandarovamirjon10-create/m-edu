import { InlineKeyboardButton, InlineKeyboardMarkup } from './telegram-ui.types';

/**
 * Reusable inline keyboard builders.
 *
 * UI generation is deliberately separate from business logic: every button is
 * created here from a translation function and an opaque callback encoder, so
 * no handler hand-writes keyboard JSON and no `callback_data` is ever built
 * from a raw resource id.
 */

/** Short action codes embedded in the signed callback envelope. */
export const CallbackCodes = {
  MAIN_MENU: 'mm',
  HELP: 'hl',
  ADMIN_MENU: 'ad',
  TEACHER_MENU: 'tc',
  CHILD_SELECT: 'cs',
  CHILD_ATTENDANCE: 'cat',
  CHILD_SCHEDULE: 'csc',
  CHILD_PAYMENTS: 'cp',
  CHILD_PROFILE: 'cpf',
  PAGE: 'pg',
  UNLINK_CONFIRM: 'ul',
  UNLINK_CANCEL: 'ulx',
  LANGUAGE: 'lg',
  /** /settings: toggle the Telegram notification channel (arg: on|off). */
  SETTINGS_TELEGRAM: 'st',
  /** /settings: apply a quiet-hours preset (arg: HH:mm-HH:mm | off). */
  SETTINGS_QUIET_HOURS: 'sq',
  /** /settings: open the per-category Telegram preference list. */
  SETTINGS_CATEGORIES: 'sc',
  /** /settings: toggle one category (arg: CATEGORY:on|off). */
  SETTINGS_CATEGORY: 'sx',
} as const;

export interface KeyboardBuilderContext {
  /** Translator for the resolved user language. */
  tr: (key: string) => string;
  /** Encodes an opaque, signed, chat-bound callback payload. */
  cb: (code: string, arg?: string) => string;
}

export interface RoleFlags {
  isAdmin: boolean;
  isTeaching: boolean;
  isStudent: boolean;
  isParent: boolean;
}

function row(...buttons: InlineKeyboardButton[]): InlineKeyboardButton[] {
  return buttons;
}

function button(text: string, callback_data: string): InlineKeyboardButton {
  return { text, callback_data };
}

/** Navigation back to the caller's own main menu. */
export function backKeyboard(ctx: KeyboardBuilderContext): InlineKeyboardMarkup {
  return { inline_keyboard: [row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU)))] };
}

/** Role-aware main menu. Only buttons backed by real commands are shown. */
export function mainMenuKeyboard(
  ctx: KeyboardBuilderContext,
  flags: RoleFlags,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];

  if (flags.isStudent) {
    rows.push(row(button(ctx.tr('btn.profile'), ctx.cb('cmd', 'profile'))));
    rows.push(
      row(
        button(ctx.tr('btn.schedule'), ctx.cb('cmd', 'schedule')),
        button(ctx.tr('btn.attendance'), ctx.cb('cmd', 'attendance')),
      ),
    );
    rows.push(
      row(
        button(ctx.tr('btn.payments'), ctx.cb('cmd', 'payments')),
        button(ctx.tr('btn.notifications'), ctx.cb('cmd', 'notifications')),
      ),
    );
  } else if (flags.isParent) {
    rows.push(
      row(
        button(ctx.tr('btn.children'), ctx.cb(CallbackCodes.CHILD_SELECT)),
        button(ctx.tr('btn.notifications'), ctx.cb('cmd', 'notifications')),
      ),
    );
  } else if (flags.isTeaching) {
    rows.push(
      row(
        button(ctx.tr('btn.today'), ctx.cb('cmd', 'today')),
        button(ctx.tr('btn.myGroups'), ctx.cb('cmd', 'groups')),
      ),
    );
    rows.push(
      row(
        button(ctx.tr('btn.students'), ctx.cb('cmd', 'students')),
        button(ctx.tr('btn.profile'), ctx.cb('cmd', 'profile')),
      ),
    );
    rows.push(
      row(
        button(ctx.tr('btn.attendance'), ctx.cb('cmd', 'attendance')),
        button(ctx.tr('btn.schedule'), ctx.cb('cmd', 'schedule')),
      ),
    );
  } else {
    rows.push(row(button(ctx.tr('btn.profile'), ctx.cb('cmd', 'profile'))));
  }

  if (flags.isAdmin) {
    rows.push(row(button(ctx.tr('btn.admin'), ctx.cb(CallbackCodes.ADMIN_MENU))));
  }

  // Backed by the registered `/copilot` command — every role may run it.
  rows.push(row(button(ctx.tr('btn.copilot'), ctx.cb('cmd', 'copilot'))));

  rows.push(
    row(
      button(ctx.tr('btn.settings'), ctx.cb('cmd', 'settings')),
      button(ctx.tr('btn.help'), ctx.cb(CallbackCodes.HELP)),
    ),
  );

  return { inline_keyboard: rows };
}

/** Admin menu. Every entry maps to an implemented, service-backed command. */
export function adminMenuKeyboard(ctx: KeyboardBuilderContext): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row(
        button(ctx.tr('btn.students'), ctx.cb('cmd', 'students')),
        button(ctx.tr('btn.teachers'), ctx.cb('cmd', 'teachers')),
      ),
      row(
        button(ctx.tr('btn.groups'), ctx.cb('cmd', 'groups')),
        button(ctx.tr('btn.attendance'), ctx.cb('cmd', 'attendance')),
      ),
      row(
        button(ctx.tr('btn.schedule'), ctx.cb('cmd', 'schedule')),
        button(ctx.tr('btn.payments'), ctx.cb('cmd', 'payments')),
      ),
      row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))),
    ],
  };
}

/** Parent's child list. The argument is a LIST INDEX, never a student id. */
export function childrenKeyboard(
  ctx: KeyboardBuilderContext,
  children: Array<{ label: string }>,
): InlineKeyboardMarkup {
  const rows = children.map((child, index) =>
    row(button(child.label, ctx.cb(CallbackCodes.CHILD_SELECT, String(index)))),
  );
  rows.push(row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))));
  return { inline_keyboard: rows };
}

/** Per-child actions, again indexed rather than id-based. */
export function childActionsKeyboard(
  ctx: KeyboardBuilderContext,
  childIndex: number,
): InlineKeyboardMarkup {
  const arg = String(childIndex);
  return {
    inline_keyboard: [
      row(
        button(ctx.tr('btn.schedule'), ctx.cb(CallbackCodes.CHILD_SCHEDULE, arg)),
        button(ctx.tr('btn.attendance'), ctx.cb(CallbackCodes.CHILD_ATTENDANCE, arg)),
      ),
      row(
        button(ctx.tr('btn.payments'), ctx.cb(CallbackCodes.CHILD_PAYMENTS, arg)),
        button(ctx.tr('btn.profile'), ctx.cb(CallbackCodes.CHILD_PROFILE, arg)),
      ),
      row(button(ctx.tr('btn.back'), ctx.cb(CallbackCodes.CHILD_SELECT))),
    ],
  };
}

/**
 * Pagination controls.
 *
 * The cursor carries only a list name + page number, signed and bound to the
 * chat. It never encodes a resource id or an authorization decision.
 */
export function paginationKeyboard(
  ctx: KeyboardBuilderContext,
  list: string,
  page: number,
  totalPages: number,
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[] = [];
  if (page > 1) {
    buttons.push(button(ctx.tr('btn.prev'), ctx.cb(CallbackCodes.PAGE, `${list}:${page - 1}`)));
  }
  if (page < totalPages) {
    buttons.push(button(ctx.tr('btn.next'), ctx.cb(CallbackCodes.PAGE, `${list}:${page + 1}`)));
  }
  return {
    inline_keyboard: [
      ...(buttons.length > 0 ? [buttons] : []),
      row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))),
    ],
  };
}

/** Language picker. */
export function languageKeyboard(ctx: KeyboardBuilderContext): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row(
        button("🇺🇿 O'zbekcha", ctx.cb(CallbackCodes.LANGUAGE, 'uz')),
        button('🇷🇺 Русский', ctx.cb(CallbackCodes.LANGUAGE, 'ru')),
      ),
      row(
        button('🇬🇧 English', ctx.cb(CallbackCodes.LANGUAGE, 'en')),
        button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU)),
      ),
    ],
  };
}

/**
 * Settings actions.
 *
 * Every state-changing button carries the TARGET value in the signed payload
 * ("on"/"off", or an explicit window), never a toggle instruction. A replay of
 * a captured button therefore re-applies the same value instead of flipping
 * the setting — the action is idempotent by construction.
 */
export function settingsKeyboard(
  ctx: KeyboardBuilderContext,
  state: {
    settingsAvailable: boolean;
    telegramEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  },
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [
    row(
      button(ctx.tr('btn.language'), ctx.cb(CallbackCodes.LANGUAGE)),
      button(ctx.tr('btn.unlink'), ctx.cb('cmd', 'unlink')),
    ),
  ];

  if (state.settingsAvailable) {
    rows.push(
      row(
        button(
          ctx.tr('btn.notifications') +
            ': ' +
            ctx.tr(state.telegramEnabled ? 'settings.state.on' : 'settings.state.off'),
          ctx.cb(CallbackCodes.SETTINGS_TELEGRAM, state.telegramEnabled ? 'off' : 'on'),
        ),
      ),
    );

    // Quiet-hours presets rather than free-text: an inline keyboard cannot
    // collect a time, and presets keep the stored value always valid.
    const presets: Array<{ label: string; arg: string }> = [
      { label: '22:00–07:00', arg: '22:00-07:00' },
      { label: '21:00–06:30', arg: '21:00-06:30' },
      { label: ctx.tr('settings.quietHoursOff'), arg: 'off' },
    ];
    rows.push(
      row(
        ...presets.map((preset) =>
          button(
            state.quietHoursEnabled &&
              `${state.quietHoursStart}-${state.quietHoursEnd}` === preset.arg
              ? `✅ ${preset.label}`
              : preset.label,
            ctx.cb(CallbackCodes.SETTINGS_QUIET_HOURS, preset.arg),
          ),
        ),
      ),
    );

    rows.push(row(button(ctx.tr('btn.categories'), ctx.cb(CallbackCodes.SETTINGS_CATEGORIES))));
  }

  rows.push(row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))));
  return { inline_keyboard: rows };
}

/** Per-category Telegram toggles (one row per category). */
export function categoriesKeyboard(
  ctx: KeyboardBuilderContext,
  categories: Array<{ key: string; label: string; telegramEnabled: boolean }>,
): InlineKeyboardMarkup {
  const rows = categories.map((category) =>
    row(
      button(
        `${category.telegramEnabled ? '✅' : '❌'} ${category.label}`,
        ctx.cb(
          CallbackCodes.SETTINGS_CATEGORY,
          `${category.key}:${category.telegramEnabled ? 'off' : 'on'}`,
        ),
      ),
    ),
  );
  rows.push(
    row(button(ctx.tr('btn.back'), ctx.cb('cmd', 'settings'))),
    row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))),
  );
  return { inline_keyboard: rows };
}

/** Irreversible-ish action: explicit confirm/cancel, never a bare "YES". */
export function unlinkConfirmKeyboard(ctx: KeyboardBuilderContext): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row(
        button(`⚠️ ${ctx.tr('unlink.confirm')}`, ctx.cb(CallbackCodes.UNLINK_CONFIRM)),
        button(ctx.tr('common.no'), ctx.cb(CallbackCodes.UNLINK_CANCEL)),
      ),
      row(button(ctx.tr('btn.menu'), ctx.cb(CallbackCodes.MAIN_MENU))),
    ],
  };
}
