# M-EDU AI Platform — `ai.service.ts` Code Audit & Remediation Plan

> **Fayl:** `apps/api/src/ai/ai.service.ts` (5,294 qator — loyihadagi eng katta xizmat fayli)  
> **Auditor:** Antigravity AI  
> **Sana:** 2026-11-11  

Ushbu hujjat `apps/api/src/ai/ai.service.ts` faylini ketma-ket (boshidan oxirigacha) tahlil qilish jarayonida aniqlangan barcha xatoliklar, xavflar va kamchiliklarni birma-bir o'z ichiga oladi. Ro'yxatdagi har bir band bo'yicha tuzatish choralari belgilangan.

---

## 1. Aniqlangan Kamchiliklar va Xatoliklar Ro'yxati

### DEFECT-01: `diagnoseStudent` da Model Gallyutsinatsiyasi Asl Ma'lumotlarni Ezib Tashlashi (Factual Overwrite)
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (1906–1912 qatorlar)
- **Xatolik Tavsifi:** Metod oxirida `return { ...aiResult, ... }` yozilgan. Agar Gemini modeli gallyutsinatsiya qilib `studentId`, `studentName`, `attendanceRate` (masalan, real 45% o'rniga 95%), `balance` (masalan, real -500 000 qarzdorlik o'rniga 0), `averageGrade` yoki `riskLevel` ni o'zgartirib qaytarsa, bu modelning soxta raqamlari bazadagi real faktik raqamlarning ustiga yoziladi.
- **Oqibati:** O'qituvchi va direktorga o'quvchi haqida noto'g'ri moliyaviy balans va soxtalashtirilgan davomat ko'rsatiladi.
- **Yechim:** Faktik ma'lumotlar (`studentId`, `studentName: fullName`, `attendanceRate: attRate`, `balance`, `averageGrade: avgGrade`, `riskLevel: calculatedRisk`, `groups: groupNames`, `factualBasis`) model chiqishidan ustun turishini qat'iy kafolatlash (`factual data takes precedence`).

---

### DEFECT-02: `draftDebtRecoveryCampaign` da Qarzdorlik Metrikalarining Yo'qotilishi (Data Loss)
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (3020–3028 qatorlar)
- **Xatolik Tavsifi:** Metodda `debtors.length` va `totalOverdue` hisoblanadi va `fallback` obyektiga qo'shiladi. Ammo metod bevosita `return this.generateStructuredJson(prompt, ..., fallback)` deb chaqirilgan. Promptdagi JSON sxemasida faqat xabar shabloni va kanallar so'ralgan. Natijada AI muvaffaqiyatli ishlaganda, qaytgan javobda `debtorsCount` va `totalOverdue` maydonlari mavjud bo'lmaydi va `undefined` bo'lib qaytadi.
- **Oqibati:** Frontendda qarzdorlar soni va jami qarz summasi AI muvaffaqiyatli ishlagan paytda ko'rinmay qoladi.
- **Yechim:** Natija olinib, unga `{ debtorsCount: debtors.length, totalOverdue }` majburiy qo'shib qaytarilishi kerak.

---

### DEFECT-03: `escapePromptText` da Kesish Sababli Buzilgan Escape Belgisi (Broken Trailing Backslash)
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (312–319 qatorlar)
- **Xatolik Tavsifi:** `escapePromptText` funksiyasida `.slice(0, maxLen)` qatori belgilarni almashtirish (`replace(/\\/g, '\\\\')` va `replace(/"/g, '\\"')`) dan *keyin* chaqirilgan. Agar matn uzun bo'lsa va kesish chegarasiga `\\\\` yoki `\\"` to'g'ri kelsa, kesilish natijasida matn oxirida yagona `\` (dangling backslash) qolishi mumkin. Bu matn JSON prompt ichiga `"${safeText}"` qilib qo'yilganda, oxirgi qo'shtirnoq `\"` ga aylanib ketadi va JSON sintaksis xatoligi keltirib chiqaradi.
- **Oqibati:** AI modeliga noto'g'ri JSON prompt boradi va model javobi buziladi.
- **Yechim:** Avval matnni `slice(0, maxLen)` bilan qirqib olib, so'ngra qo'shtirnoq va teskari sleshlar xavfsiz escape qilinishi kerak.

---

### DEFECT-04: `extractBalancedJson` da Noto'g'ri Prefiks Bo'lsa Qidiruv To'xtab Qolishi
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (325–384 qatorlar)
- **Xatolik Tavsifi:** Funksiya faqat birinchi uchragan `{` yoki `[` belgisini tekshiradi. Agar LLM matn boshida tasodifiy jingalak qavs yozgan bo'lsa (masalan: `Mana siz so'ragan {namuna}: { "summary": "..." }`), birinchi qavs valid JSON bo'lmagani uchun funksiya `catch` da darhol `null` qaytaradi va undan keyin kelgan haqiqiy to'liq JSON obyektini o'qimaydi.
- **Oqibati:** Model to'g'ri JSON qaytargan bo'lsa ham, prefiksdagi qavs tufayli tizim JSONni topolmay fallbackga tushib ketadi.
- **Yechim:** Birinchi nomzod parse bo'lmasa, siklni keyingi qavslar bo'yicha davom ettirish va parsed natija `null` yoki primitiv bo'lmasligini tekshirish.

---

### DEFECT-05: `buildOrgSnapshot` da 3 Ta Ketma-ket Count va Chegaralanmagan Sana
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (3374–3403 qatorlar)
- **Xatolik Tavsifi:** `buildOrgSnapshot` metodida bugungi davomat holatini aniqlash uchun `prisma.attendance.count` ketma-ket 3 marta (`PRESENT`, `ABSENT`, `LATE`) alohida so'rov sifatida yuborilmoqda. Bundan tashqari, faqat `date: { gte: today }` berilgan (yuqori chegara `lt: tomorrow` yo'q).
- **Oqibati:** DB ga ortiqcha 3 ta so'rov boradi va agar kelajakdagi sana bilan davomat kiritilgan bo'lsa, u bugungi ko'rsatkichlarga qo'shilib hisobni buzadi.
- **Yechim:** 3 ta `count` ni bitta `groupBy({ by: ['status'], where: { organizationId, date: { gte: today, lt: tomorrow } } })` ga almashtirish.

---

### DEFECT-06: `exportConversation` da Toshkent Vaqti va UTC Vaqti Mos Kelmasligi
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (1010–1013 qatorlar)
- **Xatolik Tavsifi:** Suhbat sarlavhasidagi sana Toshkent vaqti bilan formatlanadi (`getTashkentDateString`), ammo har bir xabarning vaqti `msg.createdAt.toISOString().slice(11, 16)` orqali olinadi. `toISOString()` esa UTC (00:00) vaqtini beradi. Toshkent esa UTC+5.
- **Oqibati:** 15:30 da yuborilgan xabar eksport qilingan Markdown faylda 10:30 deb ko'rinadi (5 soat orqada).
- **Yechim:** Xabar vaqtini Toshkent vaqt mintaqasi (`Asia/Tashkent`) bo'yicha `HH:mm` formatida chiqarish.

---

### DEFECT-07: `draftParentMessage` da Bo'sh Xabar Qaytish Xavfi
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (1966–1971 qatorlar)
- **Xatolik Tavsifi:** Agar `result.message` bo'sh satr yoki undefined bo'lsa, `message: result.message` qaytariladi, lekin `charCount: (result.message || fallbackText).length` hisoblanadi. Natijada `charCount` masalan 150 chiqadi, ammo `message` bo'sh qolishi mumkin.
- **Oqibati:** Frontendda bo'sh xabar ko'rinib, lekin belgilar soni ko'rsatiladi.
- **Yechim:** `const finalMessage = result.message?.trim() || fallbackText; return { message: finalMessage, ..., charCount: finalMessage.length };`.

---

### DEFECT-08: `generateQuiz` va `getExecutiveBriefing` da Sxema Xavfsizligi (Array Guards)
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (1708–1712, 2092–2095 qatorlar)
- **Xatolik Tavsifi:** AI natijasi spread qilinganda (`...result`, `...aiResult`), model `priorityActions` yoki `questions` massivini tushirib qoldirsa yoki massiv bo'lmagan obyekt qaytarsa, frontend komponentlarida `.map()` xatoligi (TypeError: cannot read property map of undefined) yuz beradi.
- **Oqibati:** Interfeys oq ekranga aylanadi (crash).
- **Yechim:** `questions` va `priorityActions` massiv ekanligi va kamida 1 ta elementga ega ekanligini tekshirib, aks holda fallback massivini biriktirish.

---

### DEFECT-09: Sinxron `chat()` va `runToolLoopSync` da Tayyorlangan Amallar (Actions) Yo'qotilishi
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (4188–4205, 4568–4640 qatorlar)
- **Xatolik Tavsifi:** `runToolLoopSync` funksiyasi `onPendingAction: () => undefined` berib, amallarni e'tiborsiz qoldiradi va faqat `text` qaytaradi. Agar model sinxron chat jarayonida amal (action) yaratishga buyruq bersa, action ID saqlanmaydi va frontendga qaytmaydi.
- **Oqibati:** Streaming bo'lmagan chat so'rovlarida AI tasdiqlash talab qiladigan operatsiyalarni (action) bajara olmaydi.
- **Yechim:** `runToolLoopSync` dan `{ text: string; pendingActionIds: string[] }` qaytarish, `chat()` ichida esa `pendingActionIds[0]` ni `persistTurn` ga berish va `AiChatResponse.action` da qaytarish.

---

### DEFECT-10: `getInsights` da Kelajakdagi Davomat Yozuvlarining Filtrlashsiz Qolishi
- **Joylashuvi:** `apps/api/src/ai/ai.service.ts` (1260-qator)
- **Xatolik Tavsifi:** `where: { organizationId, date: { gte: today } }` so'rovida yuqori chegara belgilanmagan.
- **Oqibati:** Kelajak kunlarga kiritilgan davomat yozuvlari bugungi statistika sifatida hisoblanadi.
- **Yechim:** `where: { organizationId, date: { gte: today, lt: tomorrow } }` qilib chegara qo'yish.

---

## 2. Tuzatish Rejasi (Execution Plan)

1. `escapePromptText` va `extractBalancedJson` xizmat yordamchilarini xavfsiz holatga keltirish.
2. `exportConversation` da Toshkent vaqt mintaqasi formatlashini to'g'rilash.
3. `getInsights` va `buildOrgSnapshot` dagi davomat so'rovlarini `lt: tomorrow` bilan chegaralash va 3 ta `count` ni 1 ta `groupBy` ga almashtirish.
4. `diagnoseStudent` da faktik DB ma'lumotlar ustuvorligini ta'minlash.
5. `draftDebtRecoveryCampaign` va `draftParentMessage` da maydonlar yo'qolishi va bo'sh matn holatlarini bartaraf etish.
6. `generateQuiz` va `getExecutiveBriefing` da massivlar uchun xavfsiz fallbacks kafolatini qo'shish.
7. `runToolLoopSync` va `chat()` da `pendingActionIds` ni to'liq qo'llab-quvvatlash.
8. Barcha o'zgarishlarni TypeScript typecheck va Vitest to'liq testlari orqali tekshirish.
