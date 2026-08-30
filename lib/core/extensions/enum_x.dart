/// Enum'larni xavfsiz parse qilish — crash resilience (spec §7, §17).
///
/// `Enum.values.byName(...)` nom topilmasa `ArgumentError` tashlaydi va
/// butun repository so'rovini yiqitadi: bitta buzilgan (corrupt) yozuv —
/// masalan eski versiya DB, noto'g'ri restore qilingan backup yoki enum
/// qiymati keyingi versiyada o'zgartirilgan yozuv — butun ro'yxatni
/// ko'rsatmay qo'yardi. `tryEnumByName` mos qiymat topilmasa `null`
/// qaytaradi; chaqiruvchi corrupt yozuvni o'tkazib yuborishni tanlaydi
/// (app hech qachon crash qilmaydi).
T? tryEnumByName<T extends Enum>(List<T> values, String? name) {
  if (name == null || name.isEmpty) return null;
  for (final value in values) {
    if (value.name == name) return value;
  }
  return null;
}
